// supabase/functions/_shared/ingestion/worker.ts
// Ciclo do worker (BER-59, spec §3 e §7), chamado pelo pg_cron a cada minuto: limpa texto
// bruto esquecido, agenda rebuscas vencidas, reivindica passos em lotes pequenos, executa,
// aplica retry e replaneja os runs tocados. Para antes de 100 s para caber no limite da
// Edge Function; o que sobrar fica para o minuto seguinte.
import { buildChapterQuery } from './queries.ts';
import { afterFailure, isTransientError, STALE_LOCK_MS } from './queue.ts';
import { planNextSteps } from './planner.ts';
import { DeferStepError, type StepContext, type StepExecutor } from './steps/context.ts';
import { EXECUTORS } from './steps/index.ts';
import type { StepRow } from './store.ts';
import type { StepKind } from './types.ts';

export const CLAIM_BATCH = 3;
export const WORKER_TIME_BUDGET_MS = 100_000;
/** Texto bruto de run abortado é apagado depois disto (spec §4). */
export const SOURCE_TEXT_TTL_MS = 24 * 60 * 60 * 1000;
export const RECHECK_EDITIONS_PER_CYCLE = 5;

export interface WorkerReport {
  processed: number;
  failed: number;
  deferred: number;
  rechecks: number;
}

const iso = (ms: number) => new Date(ms).toISOString();

export async function advanceRun(runId: string, ctx: StepContext): Promise<void> {
  const run = await ctx.store.getRun(runId);
  const steps = await ctx.store.listSteps(runId);
  const chapterNumbers = (await ctx.store.listEditionChapters(run.editionId)).map((c) => c.number);
  const planned = planNextSteps(run, steps, chapterNumbers);
  await ctx.store.enqueueSteps(planned.map((p) => ({ runId, ...p })));
}

export async function scheduleRechecks(ctx: StepContext): Promise<number> {
  const due = await ctx.store.dueRechecks(iso(ctx.now()), RECHECK_EDITIONS_PER_CYCLE);
  for (const { editionId, chapterNumbers } of due) {
    const edition = await ctx.store.getEdition(editionId);
    const chapters = (await ctx.store.listEditionChapters(editionId)).filter((c) => chapterNumbers.includes(c.number));
    await ctx.store.markRechecksScheduled(editionId, chapterNumbers);
    const run = await ctx.store.createRun(editionId, { recheckChapters: chapterNumbers });
    const forQueries = {
      title: edition.title ?? '', authors: edition.authors, publisher: edition.publisher,
      authorDeathYear: edition.authorDeathYear, firstPublishYear: edition.firstPublishYear,
    };
    await ctx.store.enqueueSteps(chapters.map((c) => ({
      runId: run.id, kind: 'discover' as const, subject: buildChapterQuery(forQueries, { number: c.number, title: c.title }),
    })));
  }
  return due.length;
}

async function executeStep(step: StepRow, ctx: StepContext, executors: Record<StepKind, StepExecutor>, report: WorkerReport) {
  const run = await ctx.store.getRun(step.runId);
  if (run.status !== 'queued' && run.status !== 'running') {
    await ctx.store.finishStep(step.id, { status: 'done', payload: { ...step.payload, skipped: 'run_encerrado' } });
    return;
  }
  if (run.status === 'queued') await ctx.store.updateRun(run.id, { status: 'running' });

  const attempts = step.attempts + 1;
  try {
    const outcome = await executors[step.kind](step, run, ctx);
    // Ordem obrigatória (Tarefa 11): enqueue -> stats -> motivo -> finishStep(done). O
    // planejador considera um tipo de passo "terminado" quando não sobra linha pendente/rodando
    // dele; gravar os passos seguintes ANTES de marcar este como `done` garante que
    // `structure`/`verify`/`publish` nunca sejam planejados antes da coleta terminar de fato.
    if (outcome.enqueue?.length) await ctx.store.enqueueSteps(outcome.enqueue.map((s) => ({ runId: run.id, ...s })));
    if (outcome.stats && Object.keys(outcome.stats).length > 0) await ctx.store.incrementRunStats(run.id, outcome.stats);
    if (outcome.runStatusReason && !run.statusReason) await ctx.store.updateRun(run.id, { statusReason: outcome.runStatusReason });
    await ctx.store.finishStep(step.id, { status: 'done', attempts, error: null, payload: { ...step.payload, ...outcome.payload } });
    report.processed++;
  } catch (err) {
    if (err instanceof DeferStepError) {
      await ctx.store.finishStep(step.id, { status: 'pending', nextAttemptAt: err.until });
      report.deferred++;
      return;
    }
    const failure = afterFailure(attempts, isTransientError(err), ctx.now());
    // Mensagem de erro nunca carrega texto de fonte: os erros vêm de rede, API ou validação.
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
    await ctx.store.finishStep(step.id, {
      status: failure.status,
      attempts,
      error: message,
      ...(failure.nextAttemptAt ? { nextAttemptAt: failure.nextAttemptAt } : {}),
    });
    if (failure.status === 'failed') report.failed++;
  }
}

export async function runWorker(ctx: StepContext, executors: Record<StepKind, StepExecutor> = EXECUTORS): Promise<WorkerReport> {
  const started = ctx.now();
  const report: WorkerReport = { processed: 0, failed: 0, deferred: 0, rechecks: 0 };

  await ctx.store.deleteSourceTextsBefore(iso(started - SOURCE_TEXT_TTL_MS));
  report.rechecks = await scheduleRechecks(ctx);

  while (ctx.now() - started < WORKER_TIME_BUDGET_MS) {
    const steps = await ctx.store.claimSteps(CLAIM_BATCH, iso(ctx.now() - STALE_LOCK_MS));
    if (steps.length === 0) break;
    const touched = new Set<string>();
    for (const step of steps) {
      touched.add(step.runId);
      await executeStep(step, ctx, executors, report);
    }
    for (const runId of touched) await advanceRun(runId, ctx);
  }
  return report;
}
