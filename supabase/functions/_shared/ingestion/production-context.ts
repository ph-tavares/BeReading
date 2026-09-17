// supabase/functions/_shared/ingestion/production-context.ts
// Contexto real dos passos (BER-59): Supabase, Anthropic/OpenAI, Tavily, Open Library,
// Google Books e o fetch seguro. robots.txt fica em cache durante a execução do worker
// (refinamento 8 do plano).
import { callAI } from '../ai.ts';
import { notifyOps } from '../ops-alert.ts';
import { createServiceClient } from '../supabase-client.ts';
import { PermanentStepError } from './queue.ts';
import type { RobotsRules } from './robots.ts';
import { DomainThrottle, type FetchDeps, fetchPage, fetchRobots } from './sources/fetch-page.ts';
import { fetchGoogleBooks } from './sources/googlebooks.ts';
import { fetchOpenLibraryEdition } from './sources/openlibrary-edition.ts';
import { tavilySearch } from './sources/tavily.ts';
import { defaultResolve, requireDns } from './ssrf.ts';
import type { StepContext } from './steps/context.ts';
import { SupabaseIngestionStore } from './supabase-store.ts';

export function buildProductionContext(): StepContext {
  const deps: FetchDeps = {
    fetchFn: fetch,
    // Fail-closed (BER-59): sem API de DNS o download recusa o host em vez de pular a checagem de
    // IP. `INGESTION_ALLOW_NO_DNS=true` só para um runtime sem DNS em que o risco foi aceito.
    resolve: requireDns(defaultResolve, Deno.env.get('INGESTION_ALLOW_NO_DNS') === 'true'),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  };
  const throttle = new DomainThrottle(deps);
  const robots = new Map<string, Promise<RobotsRules>>();
  const tavilyKey = Deno.env.get('TAVILY_API_KEY');

  return {
    store: new SupabaseIngestionStore(createServiceClient()),
    now: () => Date.now(),
    ai: callAI,
    search: (query) => {
      if (!tavilyKey) return Promise.reject(new PermanentStepError('secret TAVILY_API_KEY ausente'));
      return tavilySearch(query, tavilyKey);
    },
    fetchEdition: (isbn) => fetchOpenLibraryEdition(isbn),
    fetchGoogle: (isbn) => fetchGoogleBooks(isbn),
    fetchPage: (url, beforeRequest) => fetchPage(url, deps, throttle, beforeRequest),
    fetchRobots: (origin) => {
      if (!robots.has(origin)) robots.set(origin, fetchRobots(origin, deps, throttle));
      return robots.get(origin)!;
    },
    notify: notifyOps,
  };
}
