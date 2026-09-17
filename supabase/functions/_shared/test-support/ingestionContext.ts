// supabase/functions/_shared/test-support/ingestionContext.ts
// Contexto de passo para teste (BER-59): tudo que tocaria a rede falha alto se o teste não
// simular de propósito. Helper de teste — não é código de produção.
import { ALLOW_ALL } from '../ingestion/robots.ts';
import type { FetchedPage } from '../ingestion/sources/fetch-page.ts';
import type { StepContext } from '../ingestion/steps/context.ts';
import type { EditionRow, RunRow, StepRow } from '../ingestion/store.ts';
import type { StepKind } from '../ingestion/types.ts';
import type { MemoryIngestionStore } from './memoryIngestionStore.ts';

export const NOW = Date.parse('2026-09-16T10:00:00.000Z');

export function fakeContext(store: MemoryIngestionStore, over: Partial<StepContext> = {}): StepContext & { notifications: string[] } {
  const notifications: string[] = [];
  const unexpected = (what: string) => () => Promise.reject(new Error(`${what} não esperado neste teste`));
  return {
    store,
    now: () => NOW,
    ai: unexpected('IA'),
    search: unexpected('busca'),
    fetchEdition: () => Promise.resolve(null),
    fetchGoogle: () => Promise.resolve(null),
    fetchPage: unexpected('download'),
    fetchRobots: () => Promise.resolve(ALLOW_ALL),
    notify: (context, message) => {
      notifications.push(`${context}: ${message}`);
      return Promise.resolve();
    },
    notifications,
    ...over,
  };
}

export async function seedRun(
  store: MemoryIngestionStore,
  editionPatch: Partial<Omit<EditionRow, 'id' | 'isbn'>> = {},
  payload: RunRow['payload'] = {},
): Promise<{ edition: EditionRow; run: RunRow }> {
  const inserted = await store.insertEdition('9780000000001', null);
  const edition = await store.updateEdition(inserted.id, {
    title: 'Livro Sintético', authors: ['Autora Exemplo'], publisher: 'Editora Exemplo', language: 'pt',
    ...editionPatch,
  });
  const run = await store.createRun(edition.id, payload);
  await store.updateRun(run.id, { status: 'running' });
  return { edition, run: await store.getRun(run.id) };
}

export function stepRow(run: RunRow, kind: StepKind, subject: string, payload: Record<string, unknown> = {}): StepRow {
  return {
    id: crypto.randomUUID(), runId: run.id, kind, subject, status: 'running', attempts: 0,
    nextAttemptAt: new Date(NOW).toISOString(), lockedAt: new Date(NOW).toISOString(), error: null, payload,
  };
}

export function page(url: string, text: string, over: Partial<FetchedPage> = {}): FetchedPage {
  return { finalUrl: url, status: 200, kind: 'html', text, title: null, html: '<html></html>', pdfPages: null, headers: new Headers(), ...over };
}
