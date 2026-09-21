// supabase/functions/_shared/ingestion/steps/structure.ts
// Passo `structure` (BER-59, spec §6.3): agrupa as fontes aceitas por independência,
// confirma a estrutura da edição, localiza as afirmações já extraídas e busca de novo os
// capítulos com menos de 2 grupos independentes falando deles.
import { LIMITS } from '../budget.ts';
import { startOfUtcDay } from '../queue.ts';
import { assignIndependenceGroups, looksFullText } from '../independence.ts';
import { locateChapter } from '../locate.ts';
import { reliableSources, sourceNumbersWholeBook } from '../numbering.ts';
import { buildChapterQuery } from '../queries.ts';
import { bestStructureGuess, chaptersFromClaims, confirmStructure, mergeDeclaredKeepingParts, wholeBookNumbering } from '../structure.ts';
import type { StepExecutor } from './context.ts';

/** Capítulo com menos grupos independentes que isto ganha uma busca própria. */
export const MIN_GROUPS_PER_CHAPTER = 2;

/** Assunto do passo `structure` da segunda tentativa, depois das buscas por capítulo (spec §11, item 25). */
export const SECOND_STRUCTURE_ROUND = '2';

export const runStructureStep: StepExecutor = async (step, run, ctx) => {
  const edition = await ctx.store.getEdition(run.editionId);
  const accepted = (await ctx.store.listSources(run.id)).filter((s) => s.decision === 'accepted' && s.weight);

  const groups = assignIndependenceGroups(accepted.map((s) => ({ id: s.id, domain: s.registrableDomain, fingerprint: s.contentFingerprint, fullText: looksFullText(s) })));
  for (const source of accepted) await ctx.store.updateSource(source.id, { independenceGroup: groups.get(source.id)! });

  const claims = await ctx.store.listClaimsForRun(run.id);
  const candidates = accepted
    // Numeração do livro inteiro (defeito 5): a lista crua de um texto integral lido em blocos tem
    // "capítulo 1" em cada parte. Lista que não dá para converter com certeza não é candidata. No
    // texto integral, os capítulos citados pelas afirmações completam a lista declarada.
    .map((s) => {
      const doTexto = looksFullText(s) ? chaptersFromClaims(claims.filter((c) => c.sourceId === s.id)) : [];
      return { s, chapters: wholeBookNumbering(mergeDeclaredKeepingParts([s.declaredStructure ?? [], doTexto])) };
    })
    .filter((x): x is { s: typeof x.s; chapters: NonNullable<typeof x.chapters> } => (x.chapters?.length ?? 0) > 0)
    .map(({ s, chapters }) => ({
      sourceId: s.id, independenceGroup: groups.get(s.id)!, weight: s.weight!, tiedToIsbn: s.tiedToIsbn, chapters,
      // Só a própria extração diz se a fonte lista todos os capítulos. Peso A não basta: no teste
      // de 1984 (BER-59), a página do Gutenberg AU tinha parte do livro e declarou 9 capítulos,
      // virando uma segunda estrutura completa que rivalizava com a de 24 e derrubava as duas.
      complete: s.declaredStructureComplete ?? false,
    }));
  const forQueries = {
    title: edition.title ?? '', authors: edition.authors, publisher: edition.publisher,
    authorDeathYear: edition.authorDeathYear, firstPublishYear: edition.firstPublishYear,
  };
  // Buscas que ainda cabem: teto do run e o que sobrou da cota diária do Tavily. Sem o segundo,
  // uma busca enfileirada além da cota é adiada para o dia seguinte e segura o run inteiro, porque
  // a segunda tentativa de estrutura espera a coleta terminar (visto no teste de 1984, BER-59).
  const spentToday = await ctx.store.sumTavilyCreditsSince(startOfUtcDay(ctx.now()));
  const searchesLeft = Math.max(0, Math.min(
    LIMITS.maxSearchesPerRun - (run.stats.buscas ?? 0),
    LIMITS.maxTavilyCreditsPerDay - spentToday,
  ));

  const confirmed = confirmStructure(candidates);
  if (!confirmed) {
    // Ovo e galinha do primeiro teste com 1984 (BER-59): as buscas por capítulo só saíam depois da
    // estrutura confirmada, e a estrutura não confirmava sem elas. Na primeira tentativa, busca os
    // capítulos do melhor palpite e tenta de novo quando a coleta terminar (spec §11, item 25).
    const guess = step.subject === SECOND_STRUCTURE_ROUND ? null : bestStructureGuess(candidates);
    if (guess && searchesLeft > 0) {
      const chapters = guess.slice(0, searchesLeft);
      return {
        enqueue: chapters.map((c) => ({ kind: 'discover' as const, subject: buildChapterQuery(forQueries, { number: c.number, title: c.title }) })),
        payload: { capitulos: 0, candidatos: candidates.length, nova_tentativa: true, buscas_por_capitulo: chapters.length },
      };
    }
    return { payload: { capitulos: 0, candidatos: candidates.length }, runStatusReason: 'estrutura_nao_confirmada' };
  }

  const chapters = await ctx.store.replaceEditionChapters(edition.id, confirmed.chapters, confirmed.confidence);
  // Cada fonte tem sua convenção de numeração; sem saber a dela, número solto em obra com partes
  // fica sem capítulo (BER-59).
  const numbersWholeBook = new Map(accepted.map((s) => [s.id, sourceNumbersWholeBook(s.declaredStructure, chapters)]));
  // Resumo do livro inteiro que joga tudo num capítulo não sabe onde cada coisa acontece (BER-59).
  const confiaveis = reliableSources(accepted, claims);
  const locations = claims.map((claim) => {
    const chapter = claim.forwardReference || !confiaveis.has(claim.sourceId)
      ? null
      : locateChapter(claim.chapterRef, chapters, { sourceNumbersWholeBook: numbersWholeBook.get(claim.sourceId) === true });
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

  const thin = chapters.filter((c) => (groupsByChapter.get(c.id)?.size ?? 0) < MIN_GROUPS_PER_CHAPTER).slice(0, searchesLeft);

  return {
    enqueue: thin.map((c) => ({ kind: 'discover' as const, subject: buildChapterQuery(forQueries, { number: c.number, title: c.title }) })),
    payload: { capitulos: chapters.length, base: confirmed.basis, buscas_por_capitulo: thin.length },
  };
};
