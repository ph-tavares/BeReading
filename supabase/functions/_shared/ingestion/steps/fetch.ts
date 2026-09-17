// supabase/functions/_shared/ingestion/steps/fetch.ts
// Passo `fetch` (BER-59, spec §5): baixa, aplica a política e registra a decisão com o
// motivo. Só fonte aceita tem o texto guardado, e só até a extração terminar.
import { exceededLimit, sourceDelta } from '../budget.ts';
import { registrableDomain, simhash } from '../independence.ts';
import { detectLanguage } from '../language.ts';
import { decideSource, detectLicense, looksLikeLoginOrPaywall, type PolicyDecision, type RejectionReason } from '../policy.ts';
import { hasNoAiSignal } from '../robots.ts';
import { BOOK_FILE_MIN_PAGES, countWords, type FetchedPage } from '../sources/fetch-page.ts';
import { UnsafeUrlError } from '../ssrf.ts';
import type { NewSource } from '../store.ts';
import type { StepExecutor } from './context.ts';

const GENERIC_PUBLISHER_WORDS = /\b(editora|editorial|livros|grupo|publishing|publishers|books|ltda)\b/g;

/** Domínio parece o site oficial da editora? (ex.: Companhia das Letras → companhiadasletras.com.br) */
export function publisherDomainMatches(domain: string | null, publisher: string | null): boolean {
  if (!domain || !publisher) return false;
  const slug = publisher.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(GENERIC_PUBLISHER_WORDS, '').replace(/[^a-z0-9]/g, '');
  const label = domain.split('.')[0].replace(/[^a-z0-9]/g, '');
  return slug.length >= 5 && label.length >= 5 && (label.includes(slug) || slug.includes(label));
}

export const runFetchStep: StepExecutor = async (step, run, ctx) => {
  const limit = exceededLimit(run.stats);
  if (limit === 'fontes' || limit === 'custo') return { payload: { skipped: 'limite' }, runStatusReason: 'limite' };

  const edition = await ctx.store.getEdition(run.editionId);
  const domain = registrableDomain(step.subject);
  const base: NewSource = {
    runId: run.id, url: step.subject, finalUrl: null, registrableDomain: domain,
    title: typeof step.payload.title === 'string' ? step.payload.title : null, sourceType: null, weight: null,
    decision: 'rejected', rejectionReason: null, publicDomainBasis: null, isBookFile: false, tiedToIsbn: false,
    contentFingerprint: null, independenceGroup: null, declaredStructure: null,
  };

  const reject = async (reason: RejectionReason) => {
    const decision: PolicyDecision = { decision: 'rejected', reason, sourceType: null, weight: null, publicDomainBasis: null };
    await ctx.store.insertSource({ ...base, rejectionReason: reason });
    return { stats: sourceDelta(decision, false), payload: { decisao: 'rejected', motivo: reason } };
  };

  const initialPolicy = domain ? await ctx.store.getDomainPolicy(domain) : null;
  if (initialPolicy?.policy === 'blocked') return reject('dominio_bloqueado');

  let fetched: FetchedPage;
  try {
    fetched = await ctx.fetchPage(step.subject);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return reject('endereco_nao_publico');
    throw err;
  }

  const finalDomain = registrableDomain(fetched.finalUrl) ?? domain;
  const domainPolicy = finalDomain !== domain && finalDomain ? await ctx.store.getDomainPolicy(finalDomain) : initialPolicy;
  const finalUrl = new URL(fetched.finalUrl);
  const robots = await ctx.fetchRobots(finalUrl.origin);
  const isBookFile = fetched.kind === 'pdf' && (fetched.pdfPages ?? 0) >= BOOK_FILE_MIN_PAGES;

  const decision = decideSource({
    domain: finalDomain,
    domainPolicy,
    currentYear: new Date(ctx.now()).getUTCFullYear(),
    page: {
      status: fetched.status,
      loginOrPaywall: fetched.html ? looksLikeLoginOrPaywall(fetched.html) : false,
      supported: fetched.kind !== 'other',
      isBookFile,
      wordCount: countWords(fetched.text),
      license: fetched.html ? detectLicense(fetched.html) : null,
      pageLanguage: detectLanguage(fetched.text.slice(0, 20_000)),
      robotsAllowed: robots.isAllowed(finalUrl.pathname + finalUrl.search),
      noAi: hasNoAiSignal(fetched.headers, fetched.html),
    },
    edition: {
      authorDeathYear: edition.authorDeathYear,
      firstPublicationYear: edition.firstPublishYear ?? edition.publishYear,
      originalLanguage: edition.originalLanguage,
      publisherDomains: finalDomain && publisherDomainMatches(finalDomain, edition.publisher) ? [finalDomain] : [],
    },
  });

  const accepted = decision.decision === 'accepted';
  const source = await ctx.store.insertSource({
    ...base,
    finalUrl: fetched.finalUrl,
    registrableDomain: finalDomain,
    title: fetched.title ?? base.title,
    sourceType: decision.sourceType,
    weight: decision.weight,
    decision: decision.decision,
    rejectionReason: decision.reason,
    publicDomainBasis: decision.publicDomainBasis,
    isBookFile,
    tiedToIsbn: accepted && fetched.text.replace(/[-\s]/g, '').includes(edition.isbn),
    contentFingerprint: accepted ? simhash(fetched.text) : null,
  });

  if (!accepted) return { stats: sourceDelta(decision, isBookFile), payload: { decisao: 'rejected', motivo: decision.reason } };

  await ctx.store.saveSourceText(source.id, fetched.text);
  return {
    enqueue: [{ kind: 'extract', subject: `${source.id}#0` }],
    stats: sourceDelta(decision, isBookFile),
    payload: { decisao: 'accepted', fonte: source.id },
  };
};
