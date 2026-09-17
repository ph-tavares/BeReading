// supabase/functions/_shared/ingestion/steps/discover.ts
// Passo `discover` (BER-59): uma busca no Tavily por passo. O assunto do passo é a própria
// consulta, o que torna repetição impossível pelo índice único.
import { exceededLimit, LIMITS, searchDelta } from '../budget.ts';
import { nextUtcDay, startOfUtcDay } from '../queue.ts';
import { DeferStepError, type StepExecutor } from './context.ts';

export const runDiscoverStep: StepExecutor = async (step, run, ctx) => {
  if (exceededLimit(run.stats)) return { payload: { skipped: 'limite' }, runStatusReason: 'limite' };

  const spentToday = await ctx.store.sumRunStatSince('creditos_tavily', startOfUtcDay(ctx.now()));
  if (spentToday >= LIMITS.maxTavilyCreditsPerDay) throw new DeferStepError(nextUtcDay(ctx.now()));

  const response = await ctx.search(step.subject);
  const fetchSteps = (await ctx.store.listSteps(run.id)).filter((s) => s.kind === 'fetch');
  const known = new Set(fetchSteps.map((s) => s.subject));
  const remaining = Math.max(0, LIMITS.maxSourcesPerRun - fetchSteps.length);
  const fresh = response.results.filter((r) => !known.has(r.url)).slice(0, remaining);

  return {
    enqueue: fresh.map((r) => ({ kind: 'fetch' as const, subject: r.url, payload: { title: r.title } })),
    stats: searchDelta(response.credits),
    payload: { resultados: response.results.length, enfileirados: fresh.length },
  };
};
