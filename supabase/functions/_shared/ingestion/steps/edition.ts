// supabase/functions/_shared/ingestion/steps/edition.ts
// Passo `edition` (BER-59, spec §3): resolve a edição pelo ISBN em duas bases abertas e
// enfileira as buscas. O sumário da própria edição, quando a Open Library tem, entra como
// fonte ligada ao ISBN: é o que mais pesa para confirmar a estrutura (spec §6.3).
import { buildBookQueries } from '../queries.ts';
import { PermanentStepError } from '../queue.ts';
import type { GoogleBooksVolume } from '../sources/googlebooks.ts';
import type { StepExecutor } from './context.ts';

export const runEditionStep: StepExecutor = async (_step, run, ctx) => {
  const edition = await ctx.store.getEdition(run.editionId);
  const ol = await ctx.fetchEdition(edition.isbn);

  let google: GoogleBooksVolume | null = null;
  try {
    google = await ctx.fetchGoogle(edition.isbn);
  } catch (err) {
    // Segunda base é complemento: só derruba o passo se a primeira também não respondeu.
    if (!ol) throw err;
  }

  const title = ol?.title ?? google?.title ?? null;
  if (!title) throw new PermanentStepError(`edição não encontrada para o ISBN ${edition.isbn}`);

  const publishYear = ol?.publishYear ?? google?.publishYear ?? null;
  const updated = await ctx.store.updateEdition(edition.id, {
    title,
    authors: ol && ol.authors.length > 0 ? ol.authors : google?.authors ?? [],
    publisher: ol?.publishers[0] ?? google?.publisher ?? null,
    language: ol?.language ?? google?.language ?? null,
    publishYear,
    firstPublishYear: ol?.firstPublishYear ?? null,
    workKey: ol?.workKey ?? null,
    originalLanguage: ol?.originalLanguage ?? null,
    authorDeathYear: ol?.authorDeathYear ?? null,
  });

  if (ol && ol.tableOfContents.length > 0) {
    await ctx.store.insertSource({
      runId: run.id, url: `https://openlibrary.org/isbn/${edition.isbn}`, finalUrl: null, registrableDomain: 'openlibrary.org',
      title: 'Sumário da edição (Open Library)', sourceType: 'bibliographic', weight: 'B', decision: 'accepted',
      rejectionReason: null, publicDomainBasis: null, isBookFile: false, tiedToIsbn: true, contentFingerprint: null,
      independenceGroup: null, declaredStructure: ol.tableOfContents,
    });
  }

  const queries = buildBookQueries({
    title,
    authors: updated.authors,
    publisher: updated.publisher,
    authorDeathYear: updated.authorDeathYear,
    firstPublishYear: updated.firstPublishYear ?? publishYear,
  }, new Date(ctx.now()).getUTCFullYear());

  return { enqueue: queries.map((subject) => ({ kind: 'discover' as const, subject })), payload: { title, buscas: queries.length } };
};
