import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { aiUsageDelta, estimatedCostUsd, exceededLimit, LIMITS, searchDelta, sourceDelta } from './budget.ts';

Deno.test('aiUsageDelta: custo do Haiku em microdólares (US$ 1 / US$ 5 por milhão)', () => {
  assertEquals(aiUsageDelta('claude-haiku-4-5', { inputTokens: 6000, outputTokens: 800 }), {
    tokens_entrada: 6000, tokens_saida: 800, custo_ia_microusd: 10000,
  });
});

Deno.test('aiUsageDelta: modelo desconhecido usa preço conservador', () => {
  assertEquals(aiUsageDelta('modelo-novo', { inputTokens: 1000, outputTokens: 1000 }).custo_ia_microusd, 30000);
});

Deno.test('searchDelta e sourceDelta', () => {
  assertEquals(searchDelta(1), { buscas: 1, creditos_tavily: 1 });
  assertEquals(
    sourceDelta({ decision: 'rejected', reason: 'texto_integral_sem_autorizacao', sourceType: null, weight: null, publicDomainBasis: null }, true),
    { fontes_consideradas: 1, fontes_rejeitadas: 1, rejeitadas_texto_integral_sem_autorizacao: 1, pdfs_rejeitados: 1 },
  );
  assertEquals(
    sourceDelta({ decision: 'accepted', reason: null, sourceType: 'web', weight: 'D', publicDomainBasis: null }, false),
    { fontes_consideradas: 1, fontes_aceitas: 1 },
  );
});

Deno.test('estimatedCostUsd: IA + Tavily a US$ 0,008 por crédito', () => {
  assertEquals(estimatedCostUsd({ custo_ia_microusd: 560000, creditos_tavily: 25 }), 0.76);
});

Deno.test('exceededLimit: avisa antes de passar do teto', () => {
  assertEquals(exceededLimit({}), null);
  assertEquals(exceededLimit({ buscas: LIMITS.maxSearchesPerRun }), 'buscas');
  assertEquals(exceededLimit({ fontes_consideradas: LIMITS.maxSourcesPerRun }), 'fontes');
  assertEquals(exceededLimit({ custo_ia_microusd: LIMITS.maxCostUsdPerRun * 1_000_000 }), 'custo');
});
