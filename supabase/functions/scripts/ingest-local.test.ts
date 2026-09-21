// supabase/functions/scripts/ingest-local.test.ts
// BER-59: a leitura dos argumentos do runner local é lógica pura e fica testada (AGENTS.md §4).
import { assert, assertEquals, assertStringIncludes, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { NOW } from '../_shared/test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../_shared/test-support/memoryIngestionStore.ts';
import { parseArgs, resumeOrCreateRun } from './ingest-local.ts';

Deno.test('parseArgs: ISBN com hífen é normalizado e o padrão é o store em memória', () => {
  const options = parseArgs(['--isbn=978-85-359-1484-9']);

  assertEquals(options.isbn, '9788535914849');
  assertEquals(options.store, 'memory');
  assertEquals(options.sourcesFile, null);
  assertEquals(options.bookId, null);
  assertEquals(options.maxCycles, 100);
});

Deno.test('parseArgs: aceita store, arquivo de fontes, book-id e teto de ciclos', () => {
  const options = parseArgs([
    '--isbn=9788535914849',
    '--store=supabase',
    '--sources=./fontes.json',
    '--book-id=11111111-2222-3333-4444-555555555555',
    '--max-cycles=5',
  ]);

  assertEquals(options.store, 'supabase');
  assertEquals(options.sourcesFile, './fontes.json');
  assertEquals(options.bookId, '11111111-2222-3333-4444-555555555555');
  assertEquals(options.maxCycles, 5);
});

Deno.test('parseArgs: sem ISBN, ou com ISBN inválido, explica o uso em vez de rodar', () => {
  const semIsbn = assertThrows(() => parseArgs([]));
  assertStringIncludes((semIsbn as Error).message, '--isbn');

  const invalido = assertThrows(() => parseArgs(['--isbn=123']));
  assertStringIncludes((invalido as Error).message, '--isbn');
});

Deno.test('parseArgs: store desconhecido não silencia — recusa antes de abrir conexão', () => {
  const err = assertThrows(() => parseArgs(['--isbn=9788535914849', '--store=producao']));

  assertStringIncludes((err as Error).message, 'memory');
});

Deno.test('parseArgs: max-cycles inválido é recusado, para o loop não rodar sem teto', () => {
  const zero = assertThrows(() => parseArgs(['--isbn=9788535914849', '--max-cycles=0']));
  const texto = assertThrows(() => parseArgs(['--isbn=9788535914849', '--max-cycles=abc']));

  // Checar a mensagem, e não só que lançou: sem isso o teste passaria com qualquer erro, inclusive
  // um que viesse do ISBN.
  assert((zero as Error).message.includes('--max-cycles'), 'a mensagem tem de apontar o argumento');
  assert((texto as Error).message.includes('--max-cycles'), 'a mensagem tem de apontar o argumento');
});

Deno.test('resumeOrCreateRun: sem run em andamento, cria o run e enfileira o primeiro passo', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const edition = await store.insertEdition('9788535914849', null);

  const { run, resumed } = await resumeOrCreateRun(store, edition.id, edition.isbn);

  assertEquals(resumed, false);
  const passos = await store.listSteps(run.id);
  assertEquals(passos.map((p) => [p.kind, p.subject]), [['edition', '9788535914849']]);
});

Deno.test('resumeOrCreateRun: run em andamento é RETOMADO, não duplicado (achado do crítico, BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const edition = await store.insertEdition('9788535914849', null);
  const primeiro = await resumeOrCreateRun(store, edition.id, edition.isbn);

  // Segunda execução do mesmo comando, como depois de renovar a credencial vencida.
  const segundo = await resumeOrCreateRun(store, edition.id, edition.isbn);

  assertEquals(segundo.resumed, true);
  assertEquals(segundo.run.id, primeiro.run.id);
  assertEquals(store.runs.length, 1, 'dois runs na mesma edição disputariam os mesmos passos');
  assertEquals((await store.listSteps(primeiro.run.id)).length, 1, 'o primeiro passo não pode ser enfileirado de novo');
});

Deno.test('resumeOrCreateRun: run já terminado não bloqueia uma execução nova', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const edition = await store.insertEdition('9788535914849', null);
  const primeiro = await resumeOrCreateRun(store, edition.id, edition.isbn);
  await store.updateRun(primeiro.run.id, { status: 'partial', finishedAt: new Date(NOW).toISOString() });

  const segundo = await resumeOrCreateRun(store, edition.id, edition.isbn);

  assertEquals(segundo.resumed, false);
  assert(segundo.run.id !== primeiro.run.id);
});
