import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { LIMITS } from '../_shared/ingestion/budget.ts';
import { NOW } from '../_shared/test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../_shared/test-support/memoryIngestionStore.ts';
import { handler } from './index.ts';

const KEY = 'sb_secret_teste';
const env = (extra: Record<string, string> = {}) => (name: string): string | undefined =>
  ({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: KEY }), ...extra } as Record<string, string>)[name];

function request(body: unknown, key: string | null = KEY): Request {
  return new Request('http://localhost/ingest-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { apikey: key } : {}) },
    body: JSON.stringify(body),
  });
}

Deno.test('ingest-book: sem chave interna devolve 401', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const res = await handler(request({ isbn: '9788535914849' }, 'errada'), { store: () => store, now: () => NOW, getEnv: env() });
  assertEquals(res.status, 401);
});

Deno.test('ingest-book: ISBN inválido devolve 400', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const res = await handler(request({ isbn: '123' }), { store: () => store, now: () => NOW, getEnv: env() });
  assertEquals(res.status, 400);
});

const BOOK_ID = 'b0000000-0000-4000-8000-000000000001';

Deno.test('ingest-book: cria edição, run e o primeiro passo; reaproveita a edição na segunda vez', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const deps = { store: () => store, now: () => NOW, getEnv: env() };
  const res = await handler(request({ isbn: '978-85-359-1484-9', book_id: BOOK_ID }), deps);
  const json = await res.json();
  assertEquals(res.status, 202);
  assertEquals(store.editions.map((e) => [e.isbn, e.bookId]), [['9788535914849', BOOK_ID]]);
  assertEquals(store.steps.map((s) => [s.runId, s.kind, s.subject]), [[json.data.run_id, 'edition', '9788535914849']]);

  // BER-59 (M1): só reaproveita a edição para um run novo depois que o anterior termina.
  await store.updateRun(json.data.run_id, { status: 'succeeded', finishedAt: new Date(NOW).toISOString() });
  await handler(request({ isbn: '9788535914849' }), deps);
  assertEquals([store.editions.length, store.runs.length], [1, 2]);
});

Deno.test('ingest-book: edição com run queued/running devolve 409 com o run_id existente (BER-59 M1)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const deps = { store: () => store, now: () => NOW, getEnv: env() };
  const first = await handler(request({ isbn: '9788535914849' }), deps);
  const firstJson = await first.json();
  assertEquals(first.status, 202);

  const second = await handler(request({ isbn: '9788535914849' }), deps);
  assertEquals(second.status, 409);
  assertEquals(await second.json(), { error: 'Ingestion already running', run_id: firstJson.data.run_id });
  assertEquals(store.runs.length, 1);
});

Deno.test('ingest-book: desligado devolve 503; teto diário devolve 429', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const off = await handler(request({ isbn: '9788535914849' }), { store: () => store, now: () => NOW, getEnv: env({ INGESTION_ENABLED: 'false' }) });
  assertEquals(off.status, 503);

  const edition = await store.insertEdition('9788535914849', null);
  for (let i = 0; i < LIMITS.maxNewRunsPerDay; i++) await store.createRun(edition.id, {});
  const cheio = await handler(request({ isbn: '9788535914849' }), { store: () => store, now: () => NOW, getEnv: env() });
  assertEquals(cheio.status, 429);
});

Deno.test('ingest-book: book_id que não é UUID devolve 400; ausente segue normal (BER-59 M2)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const deps = { store: () => store, now: () => NOW, getEnv: env() };

  const invalido = await handler(request({ isbn: '9788535914849', book_id: 'book-1' }), deps);
  assertEquals(invalido.status, 400);
  assertEquals(await invalido.json(), { error: 'Invalid book_id' });
  assertEquals(store.editions.length, 0);

  const ausente = await handler(request({ isbn: '9788535914849' }), deps);
  assertEquals(ausente.status, 202);
  assertEquals(store.editions[0].bookId, null);
});

Deno.test('ingest-book: kill switch aceita "0"/"off"/"no" e variação de caixa/espaço (BER-59 M3)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  for (const valor of ['0', 'off', 'NO', ' False ', 'FALSE']) {
    const res = await handler(request({ isbn: '9788535914849' }), { store: () => store, now: () => NOW, getEnv: env({ INGESTION_ENABLED: valor }) });
    assertEquals(res.status, 503, `valor "${valor}" devia desligar a ingestão`);
  }
  const ligado = await handler(request({ isbn: '9788535914849' }), { store: () => store, now: () => NOW, getEnv: env({ INGESTION_ENABLED: 'true' }) });
  assertEquals(ligado.status, 202);
});
