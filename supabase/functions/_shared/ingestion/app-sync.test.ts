// supabase/functions/_shared/ingestion/app-sync.test.ts
// BER-60: o que a ingestão muda no livro do app quando o run fecha.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { fakeContext, NOW, seedRun, stepRow } from '../test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../test-support/memoryIngestionStore.ts';
import { type AppBook, appChapterTitle, planAppChapters } from './app-sync.ts';
import { runPublishStep } from './steps/publish.ts';
import type { EditionChapter } from './types.ts';

// 1984 em miniatura: duas partes, 2 + 1 capítulos.
const EDICAO: EditionChapter[] = [
  { id: 'e1', number: 1, partLabel: 'Parte 1', numberInPart: 1, title: null },
  { id: 'e2', number: 2, partLabel: 'Parte 1', numberInPart: 2, title: null },
  { id: 'e3', number: 3, partLabel: 'Part Two', numberInPart: 1, title: null },
];
const livro = (over: Partial<AppBook> = {}): AppBook => ({
  id: 'b1', addedBy: 'leitor', totalPages: 300, chapterCount: 9, hasClosedChapter: false, ...over,
});

Deno.test('appChapterTitle: rótulo "Parte X - Capítulo Y" que a ponte do quiz lê; sem parte, o título', () => {
  assertEquals(EDICAO.map(appChapterTitle), ['Parte 1 - Capítulo 1', 'Parte 1 - Capítulo 2', 'Parte 2 - Capítulo 1']);
  assertEquals(appChapterTitle({ id: 'x', number: 4, partLabel: null, numberInPart: null, title: 'A chegada' }), 'A chegada');
  assertEquals(appChapterTitle({ id: 'x', number: 4, partLabel: null, numberInPart: null, title: null }), 'Capítulo 4');
});

Deno.test('planAppChapters: livro do leitor sem capítulo fechado ganha a estrutura da edição', () => {
  const plano = planAppChapters(livro(), EDICAO)!;
  assertEquals(plano.map((c) => [c.number, c.title, c.start_page, c.end_page]), [
    [1, 'Parte 1 - Capítulo 1', 1, 100],
    [2, 'Parte 1 - Capítulo 2', 101, 200],
    [3, 'Parte 2 - Capítulo 1', 201, 300],
  ]);
});

Deno.test('planAppChapters: não mexe no catálogo, em livro com capítulo fechado, nem quando a contagem já bate', () => {
  assertEquals(planAppChapters(livro({ addedBy: null }), EDICAO), null);
  assertEquals(planAppChapters(livro({ hasClosedChapter: true }), EDICAO), null);
  assertEquals(planAppChapters(livro({ chapterCount: 3 }), EDICAO), null);
  assertEquals(planAppChapters(livro({ totalPages: 2 }), EDICAO), null);
  assertEquals(planAppChapters(livro(), []), null);
});

async function runComEstrutura(store: MemoryIngestionStore, isbnDoLivro: string) {
  const { run, edition } = await seedRun(store);
  await store.replaceEditionChapters(edition.id, EDICAO.map(({ number, partLabel, numberInPart, title }) => ({ number, part: partLabel, numberInPart, title })), 1);
  await store.insertSource({
    runId: run.id, url: 'https://gutenberg.org/p', finalUrl: 'https://gutenberg.org/p', registrableDomain: 'gutenberg.org', title: null,
    sourceType: 'public_domain_text', weight: 'A', decision: 'accepted', rejectionReason: null,
    publicDomainBasis: null, isBookFile: false, tiedToIsbn: false, contentFingerprint: null, independenceGroup: null,
    declaredStructure: null,
  });
  return { run, edition, isbnDoLivro };
}

Deno.test('publish: refaz os capítulos do livro do leitor e reabre o quiz sem conteúdo (BER-60)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await runComEstrutura(store, '9780000000001');
  store.appBooks.set('leitor-1', { ...livro({ id: 'leitor-1', hasClosedChapter: false }), isbn: edition.isbn });
  store.appBooks.set('catalogo', { ...livro({ id: 'catalogo', addedBy: null }), isbn: edition.isbn });
  store.noContentQuizzes.set('catalogo', ['cap-sem-conteudo']);
  const gerados: string[] = [];
  const ctx = fakeContext(store, { generateQuiz: (id) => { gerados.push(id); return Promise.resolve(); } });

  const outcome = await runPublishStep(stepRow(run, 'publish', '-'), run, ctx);

  assertEquals(store.appChapters.get('leitor-1')?.map((c) => c.title), ['Parte 1 - Capítulo 1', 'Parte 1 - Capítulo 2', 'Parte 2 - Capítulo 1']);
  assertEquals(store.appChapters.has('catalogo'), false, 'livro do catálogo não é mexido');
  assertEquals(gerados, ['cap-sem-conteudo']);
  assertEquals(outcome.payload?.app, { livros: 2, capitulos_refeitos: 1, quizzes_reabertos: 1 });
});

Deno.test('publish: falha ao atualizar o livro do app avisa e não impede o run de fechar', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await runComEstrutura(store, '9780000000001');
  store.appBooks.set('leitor-1', { ...livro({ id: 'leitor-1' }), isbn: edition.isbn });
  store.getAppBook = () => Promise.reject(new Error('banco fora'));
  const ctx = fakeContext(store);

  await runPublishStep(stepRow(run, 'publish', '-'), run, ctx);

  assertEquals((await store.getRun(run.id)).finishedAt !== null, true);
  assertEquals(ctx.notifications.some((n) => n.includes('falha ao atualizar o livro do app: banco fora')), true);
});
