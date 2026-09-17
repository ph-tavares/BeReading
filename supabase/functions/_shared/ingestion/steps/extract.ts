// supabase/functions/_shared/ingestion/steps/extract.ts
// Passo `extract` (BER-59, spec §6.1): um bloco de texto por passo (`fonte#bloco`), para
// caber no tempo de uma Edge Function. O capítulo em andamento passa ao próximo bloco, e o
// texto bruto é apagado assim que o último bloco termina — ou se o teto de custo chegar.
import { aiUsageDelta, exceededLimit } from '../budget.ts';
import { buildExtractionPrompt, EXTRACTION_MAX_TOKENS, parseExtraction, splitIntoChunks } from '../extraction.ts';
import { mergeDeclared } from '../structure.ts';
import type { ChapterRef } from '../types.ts';
import { AI_STEP_TIMEOUT_MS, type StepExecutor } from './context.ts';

export const runExtractStep: StepExecutor = async (step, run, ctx) => {
  const [sourceId, indexText] = step.subject.split('#');
  const index = Number(indexText);

  if (exceededLimit(run.stats) === 'custo') {
    await ctx.store.deleteSourceText(sourceId);
    return { payload: { skipped: 'limite' }, runStatusReason: 'limite' };
  }

  const text = await ctx.store.getSourceText(sourceId);
  if (text === null) return { payload: { skipped: 'texto_ja_descartado' } };

  const chunks = splitIntoChunks(text);
  const chunk = chunks[index];
  if (chunk === undefined) {
    await ctx.store.deleteSourceText(sourceId);
    return { payload: { skipped: 'bloco_inexistente' } };
  }

  const [source, edition] = await Promise.all([ctx.store.getSource(sourceId), ctx.store.getEdition(run.editionId)]);
  const previousChapter = (step.payload.previousChapter as ChapterRef | undefined) ?? null;

  const result = await ctx.ai({
    prompt: buildExtractionPrompt({
      bookTitle: edition.title ?? '',
      authors: edition.authors,
      sourceUrl: source.finalUrl ?? source.url,
      chunkIndex: index,
      chunkCount: chunks.length,
      previousChapter,
    }, chunk),
    maxTokens: EXTRACTION_MAX_TOKENS,
    temperature: 0,
    timeoutMs: AI_STEP_TIMEOUT_MS,
  });
  // O gasto vai ao run antes de parsear (BER-59): resposta inválida também custou, e se ficasse
  // no resultado do passo, que só é somado quando ele termina bem, o teto de custo não a veria.
  await ctx.store.incrementRunStats(run.id, aiUsageDelta(result.model, result.usage));
  const parsed = parseExtraction(result.text);

  // Retentativa do mesmo bloco (spec §7): substitui as afirmações que já tinha gravado, não duplica.
  await ctx.store.deleteClaimsForChunk(sourceId, index);
  await ctx.store.insertClaims(parsed.claims.map((claim) => ({ runId: run.id, sourceId, chunkIndex: index, ...claim })));
  if (parsed.structure.length > 0) {
    await ctx.store.updateSource(sourceId, { declaredStructure: mergeDeclared([source.declaredStructure ?? [], parsed.structure]) });
  }

  const lastChapter = [...parsed.claims].reverse().find((c) => c.chapterRef && !c.isInterpretation)?.chapterRef ?? previousChapter;
  const isLast = index + 1 >= chunks.length;
  if (isLast) await ctx.store.deleteSourceText(sourceId);

  return {
    enqueue: isLast ? [] : [{ kind: 'extract', subject: `${sourceId}#${index + 1}`, payload: { previousChapter: lastChapter } }],
    payload: { afirmacoes: parsed.claims.length, descartadas: parsed.rejected.length },
  };
};
