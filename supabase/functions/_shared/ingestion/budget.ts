// supabase/functions/_shared/ingestion/budget.ts
// Tetos de custo da ingestão (BER-59, spec §7). Custo é medido pelo `usage` real de cada
// chamada, em microdólares inteiros para somar sem erro de ponto flutuante no jsonb do run.
import type { AIUsage } from '../ai.ts';
import type { PolicyDecision } from './policy.ts';

export const LIMITS = {
  maxSearchesPerRun: 30,
  maxSourcesPerRun: 60,
  maxCostUsdPerRun: 2,
  /**
   * Um livro sozinho chega ao teto de buscas do run (30): 5 sobre o livro e uma por capítulo. Com
   * a cota diária em 30, o primeiro teste do 1984 não coube num dia (BER-59). 120 dá 4 livros por
   * dia; o teto real é o plano do Tavily (1.000 créditos/mês no gratuito), ou seja ~33 livros/mês.
   */
  maxTavilyCreditsPerDay: 120,
  maxNewRunsPerDay: 10,
} as const;

/** US$ 0,008 por crédito no pago conforme uso do Tavily. */
export const TAVILY_MICROUSD_PER_CREDIT = 8000;

/** Preço em US$ por milhão de tokens = microdólares por token. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};
/** Modelo sem preço conhecido conta como o mais caro em uso comum, para o teto nunca subestimar. */
const UNKNOWN_MODEL_PRICE = { input: 5, output: 25 };

export type Stats = Record<string, number>;

export function aiUsageDelta(model: string, usage: AIUsage): Stats {
  const price = PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  return {
    tokens_entrada: usage.inputTokens,
    tokens_saida: usage.outputTokens,
    custo_ia_microusd: Math.round(usage.inputTokens * price.input + usage.outputTokens * price.output),
  };
}

export function searchDelta(credits: number): Stats {
  return { buscas: 1, creditos_tavily: credits };
}

export function sourceDelta(decision: PolicyDecision, isBookFile: boolean): Stats {
  if (decision.decision === 'accepted') return { fontes_consideradas: 1, fontes_aceitas: 1 };
  return {
    fontes_consideradas: 1,
    fontes_rejeitadas: 1,
    [`rejeitadas_${decision.reason}`]: 1,
    ...(isBookFile ? { pdfs_rejeitados: 1 } : {}),
  };
}

export function estimatedCostUsd(stats: Stats): number {
  const micro = (stats.custo_ia_microusd ?? 0) + (stats.creditos_tavily ?? 0) * TAVILY_MICROUSD_PER_CREDIT;
  return Math.round(micro / 10_000) / 100;
}

export function exceededLimit(stats: Stats): 'buscas' | 'fontes' | 'custo' | null {
  if ((stats.buscas ?? 0) >= LIMITS.maxSearchesPerRun) return 'buscas';
  if ((stats.fontes_consideradas ?? 0) >= LIMITS.maxSourcesPerRun) return 'fontes';
  if (estimatedCostUsd(stats) >= LIMITS.maxCostUsdPerRun) return 'custo';
  return null;
}
