// supabase/functions/ingest-book/index.ts
// BER-59: dispara a ingestão de conteúdo de um livro pelo ISBN. Interna (chave de servidor):
// neste ciclo quem chama é o time, pela linha de comando (docs/deploy.md). O cadastro do
// leitor (BER-60) passa a chamar no próximo ciclo. Só enfileira; o trabalho é do worker.
import { assertInternalCaller, authErrorResponse } from '../_shared/auth.ts';
import { LIMITS } from '../_shared/ingestion/budget.ts';
import { ingestionDisabled } from '../_shared/ingestion/kill-switch.ts';
import { startOfUtcDay } from '../_shared/ingestion/queue.ts';
import type { IngestionStore } from '../_shared/ingestion/store.ts';
import { SupabaseIngestionStore } from '../_shared/ingestion/supabase-store.ts';
import { internalCallerKeys } from '../_shared/keys.ts';
import { isValidIsbnFormat, normalizeIsbn } from '../_shared/openlibrary.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

export interface IngestBookDeps {
  store: () => IngestionStore;
  now: () => number;
  getEnv: (name: string) => string | undefined;
}

const defaultDeps: IngestBookDeps = {
  store: () => new SupabaseIngestionStore(createServiceClient()),
  now: () => Date.now(),
  getEnv: (name) => Deno.env.get(name),
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// BER-59 (M2): `book_id` é opcional, mas quando vem precisa ser um UUID de verdade — o campo
// termina em `book_editions.book_id`, uma FK para `books.id`.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(req: Request, deps: IngestBookDeps = defaultDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    assertInternalCaller(req.headers, internalCallerKeys(deps.getEnv));
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: { isbn?: unknown; book_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const isbn = typeof body.isbn === 'string' ? normalizeIsbn(body.isbn) : '';
  if (!isValidIsbnFormat(isbn)) return json(400, { error: 'Invalid ISBN format' });

  if (body.book_id !== undefined && body.book_id !== null && !(typeof body.book_id === 'string' && UUID_RE.test(body.book_id))) {
    return json(400, { error: 'Invalid book_id' });
  }
  const bookId = typeof body.book_id === 'string' ? body.book_id : null;

  if (ingestionDisabled(deps.getEnv('INGESTION_ENABLED'))) return json(503, { error: 'Ingestion disabled' });

  const store = deps.store();
  if (await store.countRunsSince(startOfUtcDay(deps.now())) >= LIMITS.maxNewRunsPerDay) {
    return json(429, { error: 'Daily ingestion limit reached' });
  }

  let edition = await store.findEditionByIsbn(isbn);
  if (!edition) edition = await store.insertEdition(isbn, bookId);
  else if (bookId && edition.bookId !== bookId) edition = await store.updateEdition(edition.id, { bookId });

  // BER-59 (M1): duas ingestões da mesma edição ao mesmo tempo disputariam os mesmos passos e
  // duplicariam custo; devolve o run já em andamento em vez de abrir outro.
  const active = await store.findActiveRun(edition.id);
  if (active) return json(409, { error: 'Ingestion already running', run_id: active.id });

  const run = await store.createRun(edition.id, {});
  await store.enqueueSteps([{ runId: run.id, kind: 'edition', subject: isbn }]);

  return json(202, { data: { run_id: run.id, edition_id: edition.id }, error: null });
}

if (import.meta.main) Deno.serve((req) => handler(req));
