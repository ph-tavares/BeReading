import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import type { AIRequest } from '../ai.ts';
import { fakeContext, NOW, page } from '../test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../test-support/memoryIngestionStore.ts';
import { HttpStatusError } from './queue.ts';
import { RECHECK_AFTER_MS } from './recheck.ts';
import { DeferStepError, type StepContext } from './steps/context.ts';
import { EXECUTORS } from './steps/index.ts';
import { RECHECK_EDITIONS_PER_CYCLE, runWorker, scheduleRechecks } from './worker.ts';

// Livro, fontes e textos sintéticos (repositório público). Vocabulário diferente entre as
// duas fontes de propósito: precisam ficar em grupos de independência distintos (§5.6), senão
// o simhash as funde como cópia por terem o mesmo conteúdo.
const TEXTO_GUTENBERG = 'Ana chega à cidade e procura o irmão perdido há anos, sem saber onde ele mora. '.repeat(25);
const TEXTO_BLOG = 'Marcos atravessa a floresta escura em busca do tesouro escondido pelo avô antes da guerra. '.repeat(25);

const EXTRACAO = {
  estrutura: [
    { numero: 1, parte: null, numero_na_parte: null, titulo: 'A chegada' },
    { numero: 2, parte: null, numero_na_parte: null, titulo: 'O irmão' },
  ],
  afirmacoes: [
    { capitulo: { numero: 1 }, tipo: 'evento', texto: 'Ana chega à cidade.', interpretacao: false, antecipa: false },
    { capitulo: { numero: 2 }, tipo: 'evento', texto: 'Ana encontra o irmão.', interpretacao: false, antecipa: false },
  ],
};

function pipelineContext(store: MemoryIngestionStore, over: Partial<StepContext> = {}) {
  const prompts = { extracao: 0, agrupamento: 0 };
  const ai = (req: AIRequest) => {
    const isGrouping = req.prompt.includes('"grupos"');
    if (isGrouping) prompts.agrupamento++;
    else prompts.extracao++;
    const text = JSON.stringify(isGrouping ? { grupos: [[1, 2]], contradicoes: [] } : EXTRACAO);
    return Promise.resolve({ text, model: 'claude-haiku-4-5', usage: { inputTokens: 2000, outputTokens: 300 } });
  };
  const ctx = fakeContext(store, {
    ai,
    fetchEdition: () => Promise.resolve({
      title: 'Livro Sintético', authors: ['Autora Exemplo'], authorDeathYear: 1900, publishers: ['Editora Exemplo'], language: 'pt',
      publishYear: 2001, firstPublishYear: 1890, workKey: '/works/OL1W', originalLanguage: 'pt', tableOfContents: [],
    }),
    search: () => Promise.resolve({
      results: [{ url: 'https://www.gutenberg.org/ebooks/1', title: 'Texto' }, { url: 'https://blog.com/resumo', title: 'Resumo' }],
      credits: 1,
    }),
    fetchPage: (url) => Promise.resolve(page(url, url.includes('gutenberg') ? TEXTO_GUTENBERG : TEXTO_BLOG)),
    ...over,
  });
  return { ctx, prompts };
}

async function seed(store: MemoryIngestionStore) {
  store.policies.push({ domain: 'gutenberg.org', policy: 'allowed', weight: 'A', sourceType: 'public_domain_text', authorizesFullText: true, hostCountry: 'US' });
  const edition = await store.insertEdition('9780000000001', null);
  const run = await store.createRun(edition.id, {});
  await store.enqueueSteps([{ runId: run.id, kind: 'edition', subject: edition.isbn }]);
  return { edition, run };
}

Deno.test('runWorker: ISBN até conhecimento publicado, sem sobrar texto bruto', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { edition, run } = await seed(store);
  const { ctx, prompts } = pipelineContext(store);

  const report = await runWorker(ctx);

  const final = await store.getRun(run.id);
  assertEquals([final.status, final.statusReason], ['partial', 'capitulos_sem_confirmacao']);
  assertEquals(store.steps.every((s) => s.status === 'done'), true);
  assertEquals(store.steps.filter((s) => s.kind === 'fetch').length, 2);
  assertEquals((await store.listEditionChapters(edition.id)).map((c) => c.title), ['A chegada', 'O irmão']);

  const knowledge = await store.listKnowledge(edition.id, 2);
  assertEquals(knowledge.map((k) => [k.chapterNumber, k.status, k.facts.map((f) => f.statement)]), [
    [1, 'partial', ['Ana chega à cidade.']],
    [2, 'partial', ['Ana encontra o irmão.']],
  ]);
  assertEquals(store.texts.size, 0, 'texto bruto não pode sobrar');
  assertEquals([prompts.extracao, prompts.agrupamento], [2, 2]);
  assertEquals(final.stats.buscas, 5);
  assertEquals(final.stats.fontes_aceitas, 2);
  assert(report.processed > 0);
  assertEquals(ctx.notifications.length, 1);
});

Deno.test('runWorker: erro transitório reagenda com espera; permanente falha e o run fecha pelo publish', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seed(store);
  const transient = fakeContext(store, { fetchEdition: () => Promise.reject(new HttpStatusError(503, 'fora do ar')) });
  await runWorker(transient);
  const edition = store.steps.find((s) => s.kind === 'edition')!;
  assertEquals([edition.status, edition.attempts, edition.nextAttemptAt], ['pending', 1, new Date(NOW + 60_000).toISOString()]);

  edition.nextAttemptAt = new Date(NOW).toISOString();
  const permanent = fakeContext(store);
  await runWorker(permanent);
  assertEquals((await store.getRun(run.id)).status, 'failed');
  assertEquals((await store.getRun(run.id)).statusReason, 'edicao_nao_encontrada');
});

Deno.test('runWorker: capítulo insuficiente vencido vira run de rebusca só com ele', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { edition, run } = await seed(store);
  await store.updateEdition(edition.id, { title: 'Livro Sintético', authors: ['Autora Exemplo'] });
  const [cap1] = await store.replaceEditionChapters(edition.id, [{ number: 1, part: null, numberInPart: null, title: 'A chegada' }], 1);
  await store.publishChapterKnowledge({
    editionChapterId: cap1.id, runId: run.id, status: 'insufficient', confidence: 0, summary: '', facts: [],
    nextRecheckAt: new Date(NOW - RECHECK_AFTER_MS).toISOString(),
  });
  await store.updateRun(run.id, { status: 'partial' });
  store.steps.length = 0;

  const { ctx } = pipelineContext(store, { search: () => Promise.resolve({ results: [], credits: 1 }) });
  const report = await runWorker(ctx);

  assertEquals(report.rechecks, 1);
  const recheck = store.runs.find((r) => r.payload.recheckChapters)!;
  assertEquals(recheck.payload.recheckChapters, [1]);
  assertEquals(store.knowledge[0].recheckCount, 1);
  assertEquals(store.steps.filter((s) => s.runId === recheck.id).map((s) => s.kind).sort(), ['discover', 'publish', 'verify']);
});

Deno.test('scheduleRechecks: run que falha ao criar só adia a rebusca em 7 dias, não perde o capítulo', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { edition, run } = await seed(store);
  const [cap1] = await store.replaceEditionChapters(edition.id, [{ number: 1, part: null, numberInPart: null, title: 'A chegada' }], 1);
  await store.publishChapterKnowledge({
    editionChapterId: cap1.id, runId: run.id, status: 'insufficient', confidence: 0, summary: '', facts: [],
    nextRecheckAt: new Date(NOW - RECHECK_AFTER_MS).toISOString(),
  });

  const boom = new Error('run creation boom');
  store.createRun = () => Promise.reject(boom);

  const ctx = fakeContext(store);
  await assertRejects(() => scheduleRechecks(ctx), Error, 'run creation boom');

  // markRechecksScheduled já rodou antes do createRun falhar: o capítulo não fica perdido.
  assertEquals(store.knowledge[0].recheckCount, 1);
  assertEquals(store.knowledge[0].nextRecheckAt, new Date(NOW + RECHECK_AFTER_MS).toISOString());

  const due = await store.dueRechecks(new Date(NOW + RECHECK_AFTER_MS + 1).toISOString(), RECHECK_EDITIONS_PER_CYCLE);
  assertEquals(due, [{ editionId: edition.id, chapterNumbers: [1] }]);
});

Deno.test('runWorker: passo adiado devolve a tentativa que a reivindicação contou (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  await seed(store);
  const until = new Date(NOW + 3_600_000).toISOString();
  const report = await runWorker(fakeContext(store), { ...EXECUTORS, edition: () => Promise.reject(new DeferStepError(until)) });
  const edition = store.steps.find((s) => s.kind === 'edition')!;
  assertEquals([edition.status, edition.attempts, edition.nextAttemptAt, report.deferred], ['pending', 0, until, 1]);
});
