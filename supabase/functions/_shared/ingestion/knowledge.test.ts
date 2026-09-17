import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { MemoryIngestionStore } from '../test-support/memoryIngestionStore.ts';
import { getKnowledgeUpTo } from './knowledge.ts';
import type { KnowledgeRow } from './store.ts';

async function storeComCincoCapitulos() {
  const store = new MemoryIngestionStore();
  const edition = await store.insertEdition('9788535914849', null);
  const run = await store.createRun(edition.id, {});
  const chapters = await store.replaceEditionChapters(
    edition.id,
    [1, 2, 3, 4, 5].map((n) => ({ number: n, part: null, numberInPart: null, title: null })),
    1,
  );
  for (const chapter of chapters) {
    await store.publishChapterKnowledge({
      editionChapterId: chapter.id, runId: run.id, status: 'partial', confidence: 1, summary: `Resumo ${chapter.number}.`,
      facts: [{ kind: 'event', statement: `Acontece no capítulo ${chapter.number}.`, isInterpretation: false, confidence: 1, independentSupport: 1, sourceIds: [] }],
      nextRecheckAt: null,
    });
  }
  return { store, editionId: edition.id };
}

Deno.test('getKnowledgeUpTo: nunca devolve capítulo depois do atual (spec §6.4, guarda 3)', async () => {
  const { store, editionId } = await storeComCincoCapitulos();
  const rows = await getKnowledgeUpTo(store, editionId, 3);
  assertEquals(rows.map((r) => r.chapterNumber), [1, 2, 3]);
  assertEquals(rows.flatMap((r) => r.facts.map((f) => f.statement)).some((s) => s.includes('capítulo 4')), false);
});

Deno.test('getKnowledgeUpTo: filtra de novo mesmo se o store devolver capítulo a mais', async () => {
  const vazado = (n: number): KnowledgeRow => ({
    chapterNumber: n, partLabel: null, numberInPart: null, title: null, status: 'confirmed', confidence: 1, summary: '', recheckCount: 0, facts: [],
  });
  const storeComDefeito = { listKnowledge: () => Promise.resolve([vazado(1), vazado(2), vazado(9)]) };
  const rows = await getKnowledgeUpTo(storeComDefeito, 'e', 2);
  assertEquals(rows.map((r) => r.chapterNumber), [1, 2]);
});

Deno.test('getKnowledgeUpTo: capítulo atual inválido não devolve nada', async () => {
  const { store, editionId } = await storeComCincoCapitulos();
  assertEquals(await getKnowledgeUpTo(store, editionId, 0), []);
  assertEquals(await getKnowledgeUpTo(store, editionId, 2.5), []);
});
