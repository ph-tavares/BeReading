// supabase/functions/_shared/ingestion/local-context.ts
// BER-59: contexto de passo para rodar a ingestão NA MÁQUINA DO DESENVOLVEDOR.
//
// Diferença para `production-context.ts`, que fica intocado:
//   - `ai` sai pelo Claude Code CLI (ai-claude-code.ts), não pela API key;
//   - `search` é escolhido por quem chama (Tavily real quando há chave, lista fixa quando não há);
//   - `cpuMs` devolve null de propósito (ver abaixo);
//   - `notify` imprime no terminal em vez de chamar o webhook de operação.
// Rede, política de fonte, SSRF, robots e limite por domínio são os MESMOS de produção — é o que
// torna o run local parecido com o do servidor.
//
// A montagem de `deps`/`throttle`/`robots` é uma cópia deliberada de `production-context.ts`:
// aquele arquivo é caminho de produção e não é alterado por este ciclo.
import { claudeCodeAI, LOCAL_AI_TIMEOUT_MS } from '../ai-claude-code.ts';
import type { AIRequest, AIResult } from '../ai.ts';
import { PermanentStepError } from './queue.ts';
import type { RobotsRules } from './robots.ts';
import { DomainThrottle, type FetchDeps, fetchPage, fetchRobots } from './sources/fetch-page.ts';
import { fetchGoogleBooks } from './sources/googlebooks.ts';
import { fetchOpenLibraryEdition } from './sources/openlibrary-edition.ts';
import type { SearchResponse } from './sources/tavily.ts';
import { defaultResolve, requireDns } from './ssrf.ts';
import type { StepContext } from './steps/context.ts';
import type { IngestionStore } from './store.ts';

export interface LocalContextOptions {
  store: IngestionStore;
  /** Descoberta de fontes. O runner passa Tavily real ou uma lista fixa de URLs. */
  search: (query: string) => Promise<SearchResponse>;
  /** Trocável só para teste; o padrão é o Claude Code. */
  ai?: (req: AIRequest) => Promise<AIResult>;
  /** Trocável só para teste; o padrão escreve no terminal. */
  log?: (linha: string) => void;
}

export function buildLocalContext(options: LocalContextOptions): StepContext {
  const log = options.log ?? ((linha: string) => console.log(linha));
  const deps: FetchDeps = {
    fetchFn: fetch,
    resolve: requireDns(defaultResolve, Deno.env.get('INGESTION_ALLOW_NO_DNS') === 'true'),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  };
  const throttle = new DomainThrottle(deps);
  const robots = new Map<string, Promise<RobotsRules>>();

  return {
    store: options.store,
    now: () => Date.now(),
    ai: options.ai ?? claudeCodeAI(undefined, { timeoutMs: LOCAL_AI_TIMEOUT_MS }),
    search: options.search,
    fetchEdition: (isbn) => fetchOpenLibraryEdition(isbn),
    fetchGoogle: (isbn) => fetchGoogleBooks(isbn),
    fetchPage: (url, beforeRequest, opts) => fetchPage(url, deps, throttle, beforeRequest, opts),
    fetchRobots: (origin) => {
      if (!robots.has(origin)) robots.set(origin, fetchRobots(origin, deps, throttle));
      return robots.get(origin)!;
    },
    notify: (contexto, mensagem) => {
      log(`[aviso:${contexto}] ${mensagem}`);
      return Promise.resolve();
    },
    /**
     * null de propósito. Em produção isto existe para caber nos 2 s de CPU da Edge Function, e o
     * worker para de reivindicar passo depois de 1 s (spec §11, item 26). Fora do Edge Runtime esse
     * teto não existe, e respeitá-lo faria o run local parar a cada ciclo por um limite imaginário.
     */
    cpuMs: () => null,
  };
}

/** Descoberta sem Tavily: devolve sempre as mesmas URLs, dadas pelo runner. */
export function fixedSearch(urls: { url: string; title?: string }[]): (query: string) => Promise<SearchResponse> {
  if (urls.length === 0) {
    return () => Promise.reject(new PermanentStepError('lista de fontes fixas vazia'));
  }
  return () => Promise.resolve({ results: urls.map((u) => ({ url: u.url, title: u.title ?? '' })), credits: 0 });
}
