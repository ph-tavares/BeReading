import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { fakeContext, NOW, seedRun, stepRow } from '../../test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../../test-support/memoryIngestionStore.ts';
import type { AIRequest } from '../../ai.ts';
import { RECHECK_AFTER_MS } from '../recheck.ts';
import type { NewSource, RunRow } from '../store.ts';
import type { SourceWeight } from '../types.ts';
import { runExtractStep } from './extract.ts';
import { runPublishStep, structureDivergence } from './publish.ts';
import { runStructureStep } from './structure.ts';
import { runVerifyStep } from './verify.ts';

const DOIS_CAPITULOS = [
  { number: 1, part: null, numberInPart: null, title: 'A chegada' },
  { number: 2, part: null, numberInPart: null, title: 'O irmão' },
];

function aiReturning(...responses: unknown[]) {
  const prompts: string[] = [];
  let i = 0;
  const ai = (req: AIRequest) => {
    prompts.push(req.prompt);
    const text = JSON.stringify(responses[Math.min(i++, responses.length - 1)]);
    return Promise.resolve({ text, model: 'claude-haiku-4-5', usage: { inputTokens: 1000, outputTokens: 100 } });
  };
  return { ai, prompts };
}

async function addSource(store: MemoryIngestionStore, run: RunRow, domain: string, weight: SourceWeight, over: Partial<NewSource> = {}) {
  return await store.insertSource({
    runId: run.id, url: `https://${domain}/p`, finalUrl: `https://${domain}/p`, registrableDomain: domain, title: null,
    sourceType: weight === 'A' ? 'public_domain_text' : 'web', weight, decision: 'accepted', rejectionReason: null,
    publicDomainBasis: null, isBookFile: false, tiedToIsbn: false, contentFingerprint: null, independenceGroup: null,
    declaredStructure: null, ...over,
  });
}

Deno.test('extract: grava afirmações e estrutura, passa o capítulo corrente ao próximo bloco e apaga o texto no último', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const source = await addSource(store, run, 'blog.com', 'D');
  await store.saveSourceText(source.id, `${'a'.repeat(15000)}\n\n${'b'.repeat(15000)}`);
  const { ai } = aiReturning({
    estrutura: [{ numero: 1, parte: null, numero_na_parte: null, titulo: 'A chegada' }],
    afirmacoes: [{ capitulo: { numero: 1, titulo: 'A chegada' }, tipo: 'evento', texto: 'Ana chega à cidade.', interpretacao: false, antecipa: false }],
  });
  const ctx = fakeContext(store, { ai });

  const primeiro = await runExtractStep(stepRow(run, 'extract', `${source.id}#0`), run, ctx);
  assertEquals(store.claims.map((c) => [c.runId, c.sourceId, c.statement]), [[run.id, source.id, 'Ana chega à cidade.']]);
  assertEquals((await store.getSource(source.id)).declaredStructure?.length, 1);
  assertEquals(primeiro.enqueue, [{
    kind: 'extract', subject: `${source.id}#1`,
    payload: { previousChapter: { number: 1, part: null, numberInPart: null, title: 'A chegada' } },
  }]);
  assertEquals(primeiro.stats, { tokens_entrada: 1000, tokens_saida: 100, custo_ia_microusd: 1500 });
  assertEquals(await store.getSourceText(source.id) !== null, true);

  const ultimo = await runExtractStep(stepRow(run, 'extract', `${source.id}#1`, primeiro.enqueue![0].payload), run, ctx);
  assertEquals(ultimo.enqueue, []);
  assertEquals(await store.getSourceText(source.id), null);
});

Deno.test('extract: com o teto de custo atingido, descarta o texto sem chamar a IA', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const source = await addSource(store, run, 'blog.com', 'D');
  await store.saveSourceText(source.id, 'texto');
  const caro = { ...run, stats: { custo_ia_microusd: 2_000_000 } };
  const outcome = await runExtractStep(stepRow(run, 'extract', `${source.id}#0`), caro, fakeContext(store));
  assertEquals([outcome.runStatusReason, await store.getSourceText(source.id)], ['limite', null]);
});

Deno.test('extract: reexecutar o mesmo bloco substitui as afirmações em vez de duplicar', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const source = await addSource(store, run, 'blog.com', 'D');
  // Dois blocos: o texto não é apagado depois do bloco 0, então o passo pode ser reexecutado nele.
  await store.saveSourceText(source.id, `${'a'.repeat(15000)}\n\n${'b'.repeat(15000)}`);
  const { ai } = aiReturning({
    estrutura: [],
    afirmacoes: [{ capitulo: null, tipo: 'evento', texto: 'Ana chega à cidade.', interpretacao: false, antecipa: false }],
  });
  const ctx = fakeContext(store, { ai });

  const step = stepRow(run, 'extract', `${source.id}#0`);
  await runExtractStep(step, run, ctx);
  await runExtractStep(step, run, ctx);

  const doBloco = store.claims.filter((c) => c.sourceId === source.id && c.chunkIndex === 0);
  assertEquals(doBloco.map((c) => c.statement), ['Ana chega à cidade.']);
});

Deno.test('structure: confirma por dois grupos independentes, localiza afirmações e busca capítulo com pouca cobertura', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  const a = await addSource(store, run, 'a.com', 'C', { declaredStructure: DOIS_CAPITULOS });
  const b = await addSource(store, run, 'b.com', 'D', { declaredStructure: DOIS_CAPITULOS });
  await store.insertClaims([
    { runId: run.id, sourceId: a.id, chapterRef: { number: 1, part: null, numberInPart: null, title: null }, kind: 'event', statement: 'Ana chega.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: b.id, chapterRef: { number: 1, part: null, numberInPart: null, title: null }, kind: 'event', statement: 'Ana chega à cidade.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: a.id, chapterRef: { number: 2, part: null, numberInPart: null, title: null }, kind: 'event', statement: 'Ana encontra o irmão.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: b.id, chapterRef: null, kind: 'theme', statement: 'Família.', isInterpretation: true, forwardReference: false, chunkIndex: 0 },
  ]);

  const outcome = await runStructureStep(stepRow(run, 'structure', '-'), run, fakeContext(store));

  const chapters = await store.listEditionChapters(edition.id);
  assertEquals(chapters.map((c) => c.title), ['A chegada', 'O irmão']);
  assertEquals(store.claims.map((c) => c.located), [true, true, true, false]);
  assertEquals(store.sources.map((s) => s.independenceGroup), ['a.com', 'b.com']);
  assertEquals(outcome.enqueue, [{ kind: 'discover', subject: '"Livro Sintético" Autora Exemplo capítulo 2 "O irmão" resumo' }]);
});

Deno.test('structure: sem confirmação, marca o motivo e não cria capítulos', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  await addSource(store, run, 'a.com', 'D', { declaredStructure: DOIS_CAPITULOS });
  const outcome = await runStructureStep(stepRow(run, 'structure', '-'), run, fakeContext(store));
  assertEquals(outcome.runStatusReason, 'estrutura_nao_confirmada');
  assertEquals((await store.listEditionChapters(edition.id)).length, 0);
});

Deno.test('verify: agrupa pela IA, publica fatos confirmados com as fontes e agenda rebusca quando nada confirma', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  const [cap1, cap2] = await store.replaceEditionChapters(edition.id, DOIS_CAPITULOS, 1);
  const gut = await addSource(store, run, 'gutenberg.org', 'A');
  const blog = await addSource(store, run, 'blog.com', 'D');
  await store.insertClaims([
    { runId: run.id, sourceId: gut.id, chapterRef: null, kind: 'event', statement: 'Ana chega à cidade de trem.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: blog.id, chapterRef: null, kind: 'event', statement: 'Ana chega de trem.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: blog.id, chapterRef: null, kind: 'event', statement: 'Ana encontra o irmão.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
  ]);
  await store.setClaimLocations([
    { id: store.claims[0].id, editionChapterId: cap1.id, located: true },
    { id: store.claims[1].id, editionChapterId: cap1.id, located: true },
    { id: store.claims[2].id, editionChapterId: cap2.id, located: true },
  ]);
  const { ai, prompts } = aiReturning({ grupos: [[1, 2]], contradicoes: [] });
  const ctx = fakeContext(store, { ai });

  const outcome1 = await runVerifyStep(stepRow(run, 'verify', '1'), run, ctx);
  const knowledge1 = await store.listKnowledge(edition.id, 1);
  assertEquals(knowledge1[0].status, 'partial');
  assertEquals(knowledge1[0].facts.map((f) => f.statement), ['Ana chega à cidade de trem.']);
  assertEquals(store.factSources.map((fs) => fs.sourceId).sort(), [blog.id, gut.id].sort());
  assertEquals(prompts.length, 1);
  assertEquals(outcome1.stats?.custo_ia_microusd, 1500);

  // Capítulo 2: uma afirmação só, de blog. Não chama IA, não confirma, agenda rebusca.
  await runVerifyStep(stepRow(run, 'verify', '2'), run, ctx);
  assertEquals(prompts.length, 1);
  const k2 = store.knowledge.find((k) => k.editionChapterId === cap2.id)!;
  assertEquals([k2.status, k2.nextRecheckAt], ['insufficient', new Date(NOW + RECHECK_AFTER_MS).toISOString()]);
});

Deno.test('publish: sucesso só com todo capítulo confirmado; divergência com o app registrada', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  await store.updateEdition(edition.id, { bookId: 'book-1' });
  store.bookChapters.set('book-1', [{ number: 1, title: 'Capítulo 1' }]);
  const [cap1, cap2] = await store.replaceEditionChapters(edition.id, DOIS_CAPITULOS, 1);
  await addSource(store, run, 'gutenberg.org', 'A');
  const fatos = [1, 2, 3, 4, 5].map((n) => ({ kind: 'event' as const, statement: `Fato ${n}.`, isInterpretation: false, confidence: 1, independentSupport: 1, sourceIds: [] }));
  for (const chapter of [cap1, cap2]) {
    await store.publishChapterKnowledge({ editionChapterId: chapter.id, runId: run.id, status: 'confirmed', confidence: 1, summary: '', facts: fatos, nextRecheckAt: null });
  }
  const ctx = fakeContext(store);

  await runPublishStep(stepRow(run, 'publish', '-'), run, ctx);
  const done = await store.getRun(run.id);
  assertEquals([done.status, done.statusReason, done.finishedAt !== null], ['succeeded', null, true]);
  assertEquals(store.runs[0].structureDivergence, { capitulos_no_app: 1, capitulos_confirmados: 2, titulos_diferentes: [] });
  assertEquals(ctx.notifications, []);
});

Deno.test('publish: teto de custo atingido fecha partial mesmo com todo capítulo confirmado', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  const [cap1, cap2] = await store.replaceEditionChapters(edition.id, DOIS_CAPITULOS, 1);
  await addSource(store, run, 'gutenberg.org', 'A');
  const fatos = [1, 2, 3, 4, 5].map((n) => ({ kind: 'event' as const, statement: `Fato ${n}.`, isInterpretation: false, confidence: 1, independentSupport: 1, sourceIds: [] }));
  for (const chapter of [cap1, cap2]) {
    await store.publishChapterKnowledge({ editionChapterId: chapter.id, runId: run.id, status: 'confirmed', confidence: 1, summary: '', facts: fatos, nextRecheckAt: null });
  }
  const limitado = { ...run, statusReason: 'limite' };
  const ctx = fakeContext(store);

  await runPublishStep(stepRow(run, 'publish', '-'), limitado, ctx);
  assertEquals([(await store.getRun(run.id)).status, (await store.getRun(run.id)).statusReason], ['partial', 'limite']);
});

Deno.test('publish: recheckChapters vazio não confirma tudo por vacuidade', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store, {}, { recheckChapters: [] });
  await store.replaceEditionChapters(edition.id, DOIS_CAPITULOS, 1);
  await addSource(store, run, 'gutenberg.org', 'A');
  const ctx = fakeContext(store);

  await runPublishStep(stepRow(run, 'publish', '-'), run, ctx);
  assertEquals([(await store.getRun(run.id)).status, (await store.getRun(run.id)).statusReason], ['partial', 'capitulos_sem_confirmacao']);
});

Deno.test('publish: sem fonte aceita falha; sem estrutura fica partial; ambos avisam a operação', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const ctx = fakeContext(store);
  await runPublishStep(stepRow(run, 'publish', '-'), run, ctx);
  assertEquals([(await store.getRun(run.id)).status, (await store.getRun(run.id)).statusReason], ['failed', 'nenhuma_fonte_aceita']);

  const outro = await seedRun(store);
  await addSource(store, outro.run, 'blog.com', 'D');
  await runPublishStep(stepRow(outro.run, 'publish', '-'), outro.run, ctx);
  assertEquals((await store.getRun(outro.run.id)).statusReason, 'estrutura_nao_confirmada');
  assertEquals(ctx.notifications.length, 2);
});

Deno.test('structureDivergence: ignora títulos genéricos "Capítulo N" e aponta títulos diferentes', () => {
  const confirmados = [
    { id: 'x', number: 1, partLabel: null, numberInPart: null, title: 'A chegada' },
    { id: 'y', number: 2, partLabel: null, numberInPart: null, title: 'O irmão' },
  ];
  assertEquals(structureDivergence([{ number: 1, title: 'Capítulo 1' }, { number: 2, title: 'Capítulo 2' }], confirmados), null);
  assertEquals(structureDivergence([{ number: 1, title: 'A partida' }, { number: 2, title: null }], confirmados), {
    capitulos_no_app: 2, capitulos_confirmados: 2, titulos_diferentes: [1],
  });
});

Deno.test('extract e verify: chamam a IA com timeout de 60 s (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store);
  const timeouts: (number | undefined)[] = [];
  const ai = (req: AIRequest) => {
    timeouts.push(req.timeoutMs);
    const text = req.prompt.includes('"grupos"')
      ? JSON.stringify({ grupos: [[1, 2]], contradicoes: [] })
      : JSON.stringify({ estrutura: [], afirmacoes: [] });
    return Promise.resolve({ text, model: 'claude-haiku-4-5', usage: { inputTokens: 1, outputTokens: 1 } });
  };
  const ctx = fakeContext(store, { ai });
  const source = await addSource(store, run, 'blog.com', 'D');
  await store.saveSourceText(source.id, 'texto');
  await runExtractStep(stepRow(run, 'extract', `${source.id}#0`), run, ctx);

  const [cap1] = await store.replaceEditionChapters(edition.id, DOIS_CAPITULOS, 1);
  const outra = await addSource(store, run, 'outro.com', 'D');
  await store.insertClaims([
    { runId: run.id, sourceId: source.id, chapterRef: null, kind: 'event', statement: 'A.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
    { runId: run.id, sourceId: outra.id, chapterRef: null, kind: 'event', statement: 'B.', isInterpretation: false, forwardReference: false, chunkIndex: 0 },
  ]);
  await store.setClaimLocations(store.claims.map((c) => ({ id: c.id, editionChapterId: cap1.id, located: true })));
  await runVerifyStep(stepRow(run, 'verify', '1'), run, ctx);

  assertEquals(timeouts, [60_000, 60_000]);
});
