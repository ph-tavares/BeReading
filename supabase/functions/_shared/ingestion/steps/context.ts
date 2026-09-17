// supabase/functions/_shared/ingestion/steps/context.ts
// Contrato dos executores de passo (BER-59). Toda dependência com I/O entra pelo contexto,
// para os passos rodarem em teste com store em memória e rede simulada.
import type { AIRequest, AIResult } from '../../ai.ts';
import type { Stats } from '../budget.ts';
import type { RobotsRules } from '../robots.ts';
import type { BeforeRequest, FetchedPage } from '../sources/fetch-page.ts';
import type { GoogleBooksVolume } from '../sources/googlebooks.ts';
import type { OpenLibraryEdition } from '../sources/openlibrary-edition.ts';
import type { SearchResponse } from '../sources/tavily.ts';
import type { IngestionStore, NewStep, RunRow, StepRow } from '../store.ts';

/**
 * Teto de uma chamada de IA num passo (BER-59). O worker só reivindica passo novo com menos de
 * 70 s gastos; 70 s + 60 s de IA + E/S cabem nos 150 s de relógio da Edge Function no plano grátis.
 */
export const AI_STEP_TIMEOUT_MS = 60_000;

export interface StepContext {
  store: IngestionStore;
  now: () => number;
  ai: (req: AIRequest) => Promise<AIResult>;
  search: (query: string) => Promise<SearchResponse>;
  fetchEdition: (isbn: string) => Promise<OpenLibraryEdition | null>;
  fetchGoogle: (isbn: string) => Promise<GoogleBooksVolume | null>;
  /** `beforeRequest` roda antes de cada salto (inclusive redirecionamentos) e pode recusar a fonte. */
  fetchPage: (url: string, beforeRequest?: BeforeRequest) => Promise<FetchedPage>;
  fetchRobots: (origin: string) => Promise<RobotsRules>;
  notify: (context: string, message: string) => Promise<void>;
}

export interface StepOutcome {
  /** Passos novos do mesmo run; o índice único ignora repetidos. */
  enqueue?: Omit<NewStep, 'runId'>[];
  /** Somado a `ingestion_runs.stats`. */
  stats?: Stats;
  /** Gravado no passo, para auditoria. Nunca texto de fonte. */
  payload?: Record<string, unknown>;
  /** Motivo gravado no run se ele ainda não tiver um (ex.: `limite`). */
  runStatusReason?: string;
}

export type StepExecutor = (step: StepRow, run: RunRow, ctx: StepContext) => Promise<StepOutcome>;

/** O passo não falhou: só não pode rodar antes de `until` (ex.: cota diária do Tavily). */
export class DeferStepError extends Error {
  constructor(readonly until: string) {
    super(`adiado até ${until}`);
  }
}
