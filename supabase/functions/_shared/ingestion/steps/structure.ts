// supabase/functions/_shared/ingestion/steps/structure.ts
// Passo `structure` (BER-59, spec §6.3): agrupa as fontes aceitas por independência,
// confirma a estrutura da edição, localiza as afirmações já extraídas e busca de novo os
// capítulos com menos de 2 grupos independentes falando deles.
import { LIMITS } from '../budget.ts';
import { assignIndependenceGroups } from '../independence.ts';
import { locateChapter } from '../locate.ts';
import { buildChapterQuery } from '../queries.ts';
import { confirmStructure } from '../structure.ts';
import type { StepExecutor } from './context.ts';

/** Capítulo com menos grupos independentes que isto ganha uma busca própria. */
export const MIN_GROUPS_PER_CHAPTER = 2;

export const runStructureStep: StepExecutor = async (_step, run, ctx) => {
  const edition = await ctx.store.getEdition(run.editionId);
  const accepted = (await ctx.store.listSources(run.id)).filter((s) => s.decision === 'accepted' && s.weight);

  const groups = assignIndependenceGroups(accepted.map((s) => ({ id: s.id, domain: s.registrableDomain, fingerprint: s.contentFingerprint })));
  for (const source of accepted) await ctx.store.updateSource(source.id, { independenceGroup: groups.get(source.id)! });

  const candidates = accepted
    .filter((s) => (s.declaredStructure?.length ?? 0) > 0)
    .map((s) => ({ sourceId: s.id, independenceGroup: groups.get(s.id)!, weight: s.weight!, tiedToIsbn: s.tiedToIsbn, chapters: s.declaredStructure! }));

  const confirmed = confirmStructure(candidates);
  if (!confirmed) {
    return { payload: { capitulos: 0, candidatos: candidates.length }, runStatusReason: 'estrutura_nao_confirmada' };
  }

  const chapters = await ctx.store.replaceEditionChapters(edition.id, confirmed.chapters, confirmed.confidence);
  const claims = await ctx.store.listClaimsForRun(run.id);
  const locations = claims.map((claim) => {
    const chapter = claim.forwardReference ? null : locateChapter(claim.chapterRef, chapters);
    return { id: claim.id, editionChapterId: chapter?.id ?? null, located: chapter !== null };
  });
  await ctx.store.setClaimLocations(locations);

  const groupsByChapter = new Map<string, Set<string>>();
  locations.forEach((location, i) => {
    if (!location.editionChapterId) return;
    const set = groupsByChapter.get(location.editionChapterId) ?? new Set<string>();
    set.add(groups.get(claims[i].sourceId) ?? claims[i].sourceId);
    groupsByChapter.set(location.editionChapterId, set);
  });

  const searchesLeft = Math.max(0, LIMITS.maxSearchesPerRun - (run.stats.buscas ?? 0));
  const thin = chapters.filter((c) => (groupsByChapter.get(c.id)?.size ?? 0) < MIN_GROUPS_PER_CHAPTER).slice(0, searchesLeft);
  const forQueries = {
    title: edition.title ?? '', authors: edition.authors, publisher: edition.publisher,
    authorDeathYear: edition.authorDeathYear, firstPublishYear: edition.firstPublishYear,
  };

  return {
    enqueue: thin.map((c) => ({ kind: 'discover' as const, subject: buildChapterQuery(forQueries, { number: c.number, title: c.title }) })),
    payload: { capitulos: chapters.length, base: confirmed.basis, buscas_por_capitulo: thin.length },
  };
};
