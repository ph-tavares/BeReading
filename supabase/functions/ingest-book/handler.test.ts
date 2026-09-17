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

Deno.test('ingest-book: cria edição, run e o primeiro passo; reaproveita a edição na segunda vez', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const deps = { store: () => store, now: () => NOW, getEnv: env() };
  const res = await handler(request({ isbn: '978-85-359-1484-9', book_id: 'book-1' }), deps);
  const json = await res.json();
  assertEquals(res.status, 202);
  assertEquals(store.editions.map((e) => [e.isbn, e.bookId]), [['9788535914849', 'book-1']]);
  assertEquals(store.steps.map((s) => [s.runId, s.kind, s.subject]), [[json.data.run_id, 'edition', '9788535914849']]);

  await handler(request({ isbn: '9788535914849' }), deps);
  assertEquals([store.editions.length, store.runs.length], [1, 2]);
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
