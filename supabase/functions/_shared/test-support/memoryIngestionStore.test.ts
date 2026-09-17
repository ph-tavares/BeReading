import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import type { DeclaredChapter } from '../ingestion/types.ts';
import { MemoryIngestionStore } from './memoryIngestionStore.ts';

const ch = (number: number, title: string | null): DeclaredChapter => ({ number, part: null, numberInPart: null, title });
const tres = [ch(1, 'Do título'), ch(2, 'Do livro'), ch(3, 'A denúncia')];

async function setup() {
  const store = new MemoryIngestionStore();
  const edition = await store.insertEdition('9788535910663', null);
  const run = await store.createRun(edition.id, {});
  const source = await store.insertSource({
    runId: run.id, url: 'https://exemplo.org/x', finalUrl: null, registrableDomain: 'exemplo.org', title: null, sourceType: 'web',
    weight: 'D', decision: 'accepted', rejectionReason: null, publicDomainBasis: null, isBookFile: false, tiedToIsbn: false,
    contentFingerprint: null, independenceGroup: 'exemplo.org', declaredStructure: null,
  });
  const chapters = await store.replaceEditionChapters(edition.id, tres, 0.8);
  for (const chapter of chapters) {
    await store.publishChapterKnowledge({
      editionChapterId: chapter.id, runId: run.id, status: 'confirmed', confidence: 0.9, summary: `resumo ${chapter.number}`,
      nextRecheckAt: null,
      facts: [{ kind: 'event', statement: `fato ${chapter.number}`, isInterpretation: false, confidence: 0.9, independentSupport: 2, sourceIds: [source.id] }],
    });
  }
  await store.insertClaims(chapters.map((c) => ({
    runId: run.id, sourceId: source.id, chapterRef: { number: c.number, part: null, numberInPart: null, title: null },
    kind: 'event' as const, statement: `afirmação ${c.number}`, isInterpretation: false, forwardReference: false,
  })));
  const claims = await store.listClaimsForRun(run.id);
  await store.setClaimLocations(claims.map((c, i) => ({ id: c.id, editionChapterId: chapters[i].id, located: true })));
  return { store, edition, chapters };
}

Deno.test('replaceEditionChapters: mesma estrutura mantém ids e conhecimento publicado (BER-59)', async () => {
  const { store, edition, chapters } = await setup();
  const again = await store.replaceEditionChapters(edition.id, [ch(1, 'DO TÍTULO '), ch(2, 'Do livro'), ch(3, 'A denúncia')], 0.95);
  assertEquals(again.map((c) => c.id), chapters.map((c) => c.id));
  assertEquals((await store.listKnowledge(edition.id, 3)).map((k) => k.facts.length), [1, 1, 1]);
  assertEquals(store.chapters.map((c) => c.confidence), [0.95, 0.95, 0.95]);
});

Deno.test('replaceEditionChapters: título novo no capítulo 2 troca só o capítulo 2', async () => {
  const { store, edition, chapters } = await setup();
  const again = await store.replaceEditionChapters(edition.id, [ch(1, 'Do título'), ch(2, 'Outro'), ch(3, 'A denúncia')], 0.8);
  assertEquals(again[0].id, chapters[0].id);
  assertNotEquals(again[1].id, chapters[1].id);
  assertEquals(again[2].id, chapters[2].id);
  assertEquals(again[1].title, 'Outro');
  assertEquals((await store.listKnowledge(edition.id, 3)).map((k) => k.chapterNumber), [1, 3]);
  assertEquals(store.facts.length, 2);
  assertEquals(store.factSources.length, 2);
  assertEquals(store.claims.filter((c) => c.editionChapterId === null).map((c) => c.statement), ['afirmação 2']);
});

Deno.test('replaceEditionChapters: encolher de 3 para 2 remove o capítulo 3, seu conhecimento e a localização das afirmações', async () => {
  const { store, edition, chapters } = await setup();
  const again = await store.replaceEditionChapters(edition.id, tres.slice(0, 2), 0.8);
  assertEquals(again.map((c) => c.id), chapters.slice(0, 2).map((c) => c.id));
  assertEquals((await store.listKnowledge(edition.id, 3)).map((k) => k.chapterNumber), [1, 2]);
  assertEquals(store.knowledge.length, 2);
  assertEquals(store.factSources.length, 2);
  const claim3 = store.claims.find((c) => c.statement === 'afirmação 3');
  assertEquals(claim3?.editionChapterId, null);
});

Deno.test('replaceEditionChapters: título nulo na lista nova mantém o título existente', async () => {
  const { store, edition, chapters } = await setup();
  const again = await store.replaceEditionChapters(edition.id, [ch(1, null), ch(2, 'Do livro'), ch(3, 'A denúncia')], 0.8);
  assertEquals(again[0].id, chapters[0].id);
  assertEquals(again[0].title, 'Do título');
});

Deno.test('updateRun e finishStep: campo undefined no patch não apaga o valor (como o store do Supabase)', async () => {
  const store = new MemoryIngestionStore();
  const edition = await store.insertEdition('9788535910663', null);
  const run = await store.createRun(edition.id, {});
  await store.updateRun(run.id, { status: 'running', statusReason: 'motivo' });
  await store.updateRun(run.id, { status: 'partial', statusReason: undefined });
  assertEquals([(await store.getRun(run.id)).status, (await store.getRun(run.id)).statusReason], ['partial', 'motivo']);
  await store.enqueueSteps([{ runId: run.id, kind: 'discover', subject: 'x' }]);
  const [step] = await store.listSteps(run.id);
  await store.finishStep(step.id, { status: 'pending', attempts: 1, error: 'falhou' });
  await store.finishStep(step.id, { status: 'done', attempts: undefined, error: undefined });
  const [after] = await store.listSteps(run.id);
  assertEquals([after.status, after.attempts, after.error], ['done', 1, 'falhou']);
});
