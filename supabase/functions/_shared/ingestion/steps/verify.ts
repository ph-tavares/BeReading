// supabase/functions/_shared/ingestion/steps/verify.ts
// Passo `verify` (BER-59, spec §6.2): junta as afirmações localizadas no capítulo (de todos
// os runs, para a rebusca somar ao que já havia), pede à IA só o agrupamento e publica o
// que as regras confirmam. Nada confirmado agenda nova busca em 7 dias.
import { aiUsageDelta, exceededLimit } from '../budget.ts';
import { batchClaims, buildGroupingPrompt, type Grouping, GROUPING_MAX_TOKENS, parseGrouping } from '../grouping.ts';
import { assignIndependenceGroups } from '../independence.ts';
import { locateChapter } from '../locate.ts';
import { reliableSources, sourceNumbersWholeBook } from '../numbering.ts';
import { RECHECK_AFTER_MS } from '../recheck.ts';
import type { EditionChapter } from '../types.ts';
import { type SourceSupport, verifyChapter } from '../verify.ts';
import { AI_STEP_TIMEOUT_MS, type StepExecutor } from './context.ts';

function chapterLabel(c: EditionChapter): string {
  const position = c.partLabel && c.numberInPart !== null ? `${c.partLabel}, capítulo ${c.numberInPart}` : `capítulo ${c.number}`;
  return c.title ? `${position} ("${c.title}")` : position;
}

export const runVerifyStep: StepExecutor = async (step, run, ctx) => {
  // Teto de custo atingido (BER-59, spec §7): este run não chama mais IA, então o conhecimento
  // do capítulo não é publicado por ele; o `publish` fecha o run como `partial` por `limite`.
  if (exceededLimit(run.stats) === 'custo') return { payload: { skipped: 'limite' }, runStatusReason: 'limite' };

  const chapters = await ctx.store.listEditionChapters(run.editionId);
  const chapter = chapters.find((c) => c.number === Number(step.subject));
  if (!chapter) return { payload: { skipped: 'capitulo_inexistente' } };

  // Afirmações de fontes achadas depois da estrutura (busca por capítulo) ainda não têm capítulo.
  const unlocated = (await ctx.store.listClaimsForRun(run.id)).filter((c) => c.editionChapterId === null && !c.located && !c.forwardReference);
  const fontes = await ctx.store.getSourcesByIds([...new Set(unlocated.map((c) => c.sourceId))]);
  const numbersWholeBook = new Map(fontes.map((s) => [s.id, sourceNumbersWholeBook(s.declaredStructure, chapters)]));
  // A confiabilidade é medida sobre todas as afirmações da fonte no run, não só as que faltam situar.
  const confiaveis = reliableSources(fontes, await ctx.store.listClaimsForRun(run.id));
  const newlyLocated = unlocated
    .map((c) => ({
      id: c.id,
      chapter: confiaveis.has(c.sourceId)
        ? locateChapter(c.chapterRef, chapters, { sourceNumbersWholeBook: numbersWholeBook.get(c.sourceId) === true })
        : null,
    }))
    .filter((x) => x.chapter !== null)
    .map((x) => ({ id: x.id, editionChapterId: x.chapter!.id, located: true }));
  if (newlyLocated.length > 0) await ctx.store.setClaimLocations(newlyLocated);

  const claims = await ctx.store.listLocatedClaims(chapter.id);
  const sources = (await ctx.store.getSourcesByIds([...new Set(claims.map((c) => c.sourceId))]))
    .filter((s) => s.decision === 'accepted' && s.weight);
  const groups = assignIndependenceGroups(sources.map((s) => ({ id: s.id, domain: s.registrableDomain, fingerprint: s.contentFingerprint })));
  const supports = new Map<string, SourceSupport>(
    sources.map((s) => [s.id, { sourceId: s.id, independenceGroup: groups.get(s.id)!, weight: s.weight! }]),
  );
  const usable = claims.filter((c) => supports.has(c.sourceId));

  const grouping: Grouping = { groups: [], contradictions: [] };
  if (usable.length === 1) {
    grouping.groups.push([usable[0].id]);
  } else {
    for (const batch of batchClaims(usable)) {
      const inputs = batch.map((c) => ({ id: c.id, statement: c.statement }));
      const result = await ctx.ai({ prompt: buildGroupingPrompt(chapterLabel(chapter), inputs), maxTokens: GROUPING_MAX_TOKENS, temperature: 0, timeoutMs: AI_STEP_TIMEOUT_MS });
      // Gasto registrado no run assim que a IA responde, antes de parsear (BER-59): nada escapa do teto.
      await ctx.store.incrementRunStats(run.id, aiUsageDelta(result.model, result.usage));
      const parsed = parseGrouping(result.text, inputs);
      const offset = grouping.groups.length;
      grouping.groups.push(...parsed.groups);
      grouping.contradictions.push(...parsed.contradictions.map(([a, b]) => [a + offset, b + offset] as [number, number]));
    }
  }

  const verification = verifyChapter(
    usable.map((c) => ({ id: c.id, sourceId: c.sourceId, kind: c.kind, statement: c.statement, isInterpretation: c.isInterpretation })),
    supports,
    grouping,
  );

  await ctx.store.publishChapterKnowledge({
    editionChapterId: chapter.id,
    runId: run.id,
    status: verification.status,
    confidence: verification.confidence,
    summary: verification.summary,
    facts: verification.facts,
    nextRecheckAt: verification.status === 'insufficient' ? new Date(ctx.now() + RECHECK_AFTER_MS).toISOString() : null,
  });

  return { payload: { status: verification.status, fatos: verification.facts.length, afirmacoes: usable.length } };
};
