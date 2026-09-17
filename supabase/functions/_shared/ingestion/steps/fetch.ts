// supabase/functions/_shared/ingestion/steps/fetch.ts
// Passo `fetch` (BER-59, spec §5): baixa, aplica a política e registra a decisão com o
// motivo. Só fonte aceita tem o texto guardado, e só até a extração terminar.
import { exceededLimit, sourceDelta } from '../budget.ts';
import { registrableDomain, simhash } from '../independence.ts';
import { detectLanguage } from '../language.ts';
import { decideSource, detectLicense, looksLikeLoginOrPaywall, type PolicyDecision, type RejectionReason } from '../policy.ts';
import { hasNoAiSignal } from '../robots.ts';
import { BOOK_FILE_MIN_PAGES, type BeforeRequest, countWords, type FetchedPage, SourceRejectedError } from '../sources/fetch-page.ts';
import { UnsafeUrlError } from '../ssrf.ts';
import type { NewSource } from '../store.ts';
import type { StepContext, StepExecutor, StepOutcome } from './context.ts';

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

  const reject = async (reason: RejectionReason, isBookFile = false) => {
    const decision: PolicyDecision = { decision: 'rejected', reason, sourceType: null, weight: null, publicDomainBasis: null };
    await ctx.store.insertSource({ ...base, rejectionReason: reason, isBookFile });
    return { stats: sourceDelta(decision, isBookFile), payload: { decisao: 'rejected', motivo: reason } };
  };

  const initialPolicy = domain ? await ctx.store.getDomainPolicy(domain) : null;
  if (initialPolicy?.policy === 'blocked') return reject('dominio_bloqueado');

  // Domínio bloqueado e robots.txt valem para cada salto e antes de baixar (BER-59, spec §5.9):
  // um redirecionamento não pode levar o worker a baixar de domínio bloqueado ou de caminho que
  // o robots.txt proíbe.
  const beforeRequest = async (url: URL): Promise<RejectionReason | null> => {
    const hopDomain = registrableDomain(url.toString());
    if (hopDomain && (await ctx.store.getDomainPolicy(hopDomain))?.policy === 'blocked') return 'dominio_bloqueado';
    const robots = await ctx.fetchRobots(url.origin);
    if (!robots.isAllowed(url.pathname + url.search)) return 'robots';
    return null;
  };

  if (typeof step.payload.continuacao === 'string') return continuePdf(step.payload, beforeRequest, ctx);

  let fetched: FetchedPage;
  try {
    fetched = await ctx.fetchPage(step.subject, beforeRequest);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return reject('endereco_nao_publico');
    // O motivo vem do gancho acima ou dos limites do download, todos `RejectionReason`.
    if (err instanceof SourceRejectedError) return reject(err.reason as RejectionReason, err.isBookFile);
    throw err;
  }

  const finalDomain = registrableDomain(fetched.finalUrl) ?? domain;
  const domainPolicy = finalDomain !== domain && finalDomain ? await ctx.store.getDomainPolicy(finalDomain) : initialPolicy;
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
      // O gancho `beforeRequest` já recusou antes do download o que o robots.txt proíbe.
      robotsAllowed: true,
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
  // PDF longo segue em lotes de páginas, um passo por lote, e só vai para a extração no fim. A
  // política já decidiu com o primeiro lote: idioma, contagem de páginas e sinais de autorização
  // não mudam no resto do arquivo (BER-59, limite de CPU da Edge Function).
  const next = fetched.kind === 'pdf' ? fetched.pdfNextPage : null;
  return {
    enqueue: [next ? pdfContinuation(step.subject, source.id, next) : { kind: 'extract', subject: `${source.id}#0` }],
    stats: sourceDelta(decision, isBookFile),
    payload: { decisao: 'accepted', fonte: source.id, ...(next ? { paginas_lidas: next - 1, paginas: fetched.pdfPages } : {}) },
  };
};

function pdfContinuation(url: string, sourceId: string, page: number) {
  // O assunto precisa ser único por lote: o índice (run_id, kind, subject) deduplica passos.
  return { kind: 'fetch' as const, subject: `${url}#bereading-pagina-${page}`, payload: { continuacao: sourceId, url, pagina: page } };
}

async function continuePdf(payload: Record<string, unknown>, beforeRequest: BeforeRequest, ctx: StepContext): Promise<StepOutcome> {
  const sourceId = String(payload.continuacao);
  const url = String(payload.url);
  const page = Number(payload.pagina);
  const extract = { kind: 'extract' as const, subject: `${sourceId}#0` };

  const previous = await ctx.store.getSourceText(sourceId);
  // Texto apagado pelo prazo de 24 h: não há o que completar nem extrair.
  if (previous === null) return { payload: { texto_ja_descartado: true } };

  let fetched: FetchedPage;
  try {
    fetched = await ctx.fetchPage(url, beforeRequest, { pdfFromPage: page });
  } catch (err) {
    // O arquivo mudou ou passou a ser recusado entre um lote e outro: extrai o que já foi lido.
    if (err instanceof SourceRejectedError || err instanceof UnsafeUrlError) {
      return { enqueue: [extract], payload: { lote_interrompido: err instanceof SourceRejectedError ? err.reason : 'endereco_nao_publico' } };
    }
    throw err;
  }
  if (fetched.kind !== 'pdf' || fetched.status >= 400) {
    return { enqueue: [extract], payload: { lote_interrompido: `status ${fetched.status}` } };
  }

  await ctx.store.saveSourceText(sourceId, `${previous}\n${fetched.text}`);
  const next = fetched.pdfNextPage;
  return {
    enqueue: [next ? pdfContinuation(url, sourceId, next) : extract],
    payload: { paginas_lidas: next ? next - 1 : fetched.pdfPages },
  };
}
