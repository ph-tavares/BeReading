// supabase/functions/_shared/ingestion/steps/extract.ts
// Passo `extract` (BER-59, spec §6.1): um bloco de texto por passo (`fonte#bloco`), para
// caber no tempo de uma Edge Function. O capítulo em andamento passa ao próximo bloco, e o
// texto bruto é apagado assim que o último bloco termina — ou se o teto de custo chegar.
import { aiUsageDelta, exceededLimit } from '../budget.ts';
import { buildExtractionPrompt, EXTRACTION_MAX_TOKENS, parseExtraction, splitIntoChunks } from '../extraction.ts';
import { chunkPart, partFromSource, partStillValid } from '../parts.ts';
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
  // BER-59 (M6): sem stat, um TTL agressivo ou reexecução tardia apagaria blocos de conteúdo em
  // silêncio — a contagem no run deixa visível quanto texto a extração perdeu por atraso.
  if (text === null) return { payload: { skipped: 'texto_ja_descartado' }, stats: { blocos_sem_texto: 1 } };

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

  // A parte do livro é achada pelo nosso código, não pedida ao modelo (spec §11, item 37): a URL da
  // página ("book-2-chapter-1") ou o cabeçalho no texto ("SEGUNDA PARTE") dizem onde o bloco está.
  // Sem isso, "capítulo 1" da Parte 2 vira o capítulo 1 do livro e leva spoiler para o começo.
  const parteDaFonte = partFromSource(source.finalUrl ?? source.url, source.title);
  const parteDoBloco = chunkPart(chunk, (step.payload.previousPart as string | undefined) ?? parteDaFonte ?? null);
  // Maior capítulo já visto nesta fonte: se a numeração recuar sem cabeçalho novo, a parte herdada
  // não vale mais (spec §11, item 38).
  const maiorCapituloVisto = (step.payload.maxChapter as number | undefined) ?? null;
  const capitulosDoBloco = parsed.claims.map((c) => c.chapterRef?.numberInPart ?? c.chapterRef?.number ?? null).filter((n): n is number => n !== null);
  const menorDoBloco = capitulosDoBloco.length > 0 ? Math.min(...capitulosDoBloco) : null;
  const heranca = parteDoBloco.changes || !partStillValid(maiorCapituloVisto, menorDoBloco) ? null : parteDoBloco.start;
  const parte = parteDaFonte ?? heranca;
  const comParte = parsed.claims.map((claim) => {
    if (!parte || !claim.chapterRef || claim.chapterRef.part) return claim;
    // Numa obra com partes, o "capítulo 3" que a fonte cita é o terceiro daquela parte.
    const { number, numberInPart } = claim.chapterRef;
    return { ...claim, chapterRef: { ...claim.chapterRef, part: parte, numberInPart: numberInPart ?? number, number: numberInPart === null ? null : number } };
  });

  // Retentativa do mesmo bloco (spec §7): substitui as afirmações que já tinha gravado, não duplica.
  await ctx.store.deleteClaimsForChunk(sourceId, index);
  await ctx.store.insertClaims(comParte.map((claim) => ({ runId: run.id, sourceId, chunkIndex: index, ...claim })));
  if (parsed.structure.length > 0) {
    await ctx.store.updateSource(sourceId, {
      declaredStructure: mergeDeclared([source.declaredStructure ?? [], parsed.structure]),
      // Um bloco com o sumário inteiro basta para a fonte contar como lista completa (spec §11, item 24).
      declaredStructureComplete: (source.declaredStructureComplete ?? false) || (parsed.structureComplete && parsed.structure.length > 0),
    });
  }

  const lastChapter = [...comParte].reverse().find((c) => c.chapterRef && !c.isInterpretation)?.chapterRef ?? previousChapter;
  const isLast = index + 1 >= chunks.length;
  if (isLast) await ctx.store.deleteSourceText(sourceId);

  return {
    enqueue: isLast
      ? []
      : [{ kind: 'extract', subject: `${sourceId}#${index + 1}`, payload: { previousChapter: lastChapter, previousPart: parte === null ? null : parteDoBloco.end, maxChapter: Math.max(maiorCapituloVisto ?? 0, ...capitulosDoBloco, 0) } }],
    payload: { afirmacoes: parsed.claims.length, descartadas: parsed.rejected.length, ...(parte ? { parte } : {}) },
  };
};
