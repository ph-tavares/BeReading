// supabase/functions/_shared/ingestion/steps/context.ts
// Contrato dos executores de passo (BER-59). Toda dependência com I/O entra pelo contexto,
// para os passos rodarem em teste com store em memória e rede simulada.
import type { AIRequest, AIResult } from '../../ai.ts';
import type { Stats } from '../budget.ts';
import type { RobotsRules } from '../robots.ts';
import type { FetchedPage } from '../sources/fetch-page.ts';
import type { GoogleBooksVolume } from '../sources/googlebooks.ts';
import type { OpenLibraryEdition } from '../sources/openlibrary-edition.ts';
import type { SearchResponse } from '../sources/tavily.ts';
import type { IngestionStore, NewStep, RunRow, StepRow } from '../store.ts';

export interface StepContext {
  store: IngestionStore;
  now: () => number;
  ai: (req: AIRequest) => Promise<AIResult>;
  search: (query: string) => Promise<SearchResponse>;
  fetchEdition: (isbn: string) => Promise<OpenLibraryEdition | null>;
  fetchGoogle: (isbn: string) => Promise<GoogleBooksVolume | null>;
  fetchPage: (url: string) => Promise<FetchedPage>;
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
