// supabase/functions/_shared/ingestion/worker.ts
// Ciclo do worker (BER-59, spec §3 e §7), chamado pelo pg_cron a cada minuto: limpa texto
// bruto esquecido, agenda rebuscas vencidas, reivindica um passo por vez, executa, aplica
// retry e replaneja o run tocado. Não reivindica passo novo depois de 70 s, para caber no
// limite da Edge Function; o que sobrar fica para o minuto seguinte.
import { buildChapterQuery } from './queries.ts';
import { afterFailure, isTransientError, STALE_LOCK_MS } from './queue.ts';
import { planNextSteps } from './planner.ts';
import { RECHECK_AFTER_MS } from './recheck.ts';
import { AIOutOfCreditsError } from '../ai.ts';
import { DeferStepError, type StepContext, type StepExecutor } from './steps/context.ts';
import { EXECUTORS } from './steps/index.ts';
import type { StepRow } from './store.ts';
import type { StepKind } from './types.ts';

// BER-59: o relógio da Edge Function no plano grátis é de 150 s, e o pior passo leva ~60 s de
// IA (`AI_STEP_TIMEOUT_MS`) mais E/S. Por isso o worker só reivindica um passo por vez e não
// reivindica outro depois de 70 s: um lote de 3 passos reivindicado aos 99 s estourava o relógio,
// o worker morria com os passos em `running` e eles voltavam como trava velha para sempre.
export const CLAIM_BATCH = 1;
export const WORKER_TIME_BUDGET_MS = 70_000;
/**
 * CPU por chamada (BER-59): a Edge Function morre com `CPU Time exceeded` aos 2 s. O worker para
 * de reivindicar passo novo depois de 1 s, deixando folga para o passo em andamento.
 */
export const WORKER_CPU_BUDGET_MS = 1_000;
/** Espera antes de tentar de novo depois de o saldo do provedor de IA acabar (BER-59). */
export const OUT_OF_CREDITS_RETRY_MS = 30 * 60 * 1000;
/** Texto bruto de run abortado é apagado depois disto (spec §4). */
export const SOURCE_TEXT_TTL_MS = 24 * 60 * 60 * 1000;
export const RECHECK_EDITIONS_PER_CYCLE = 5;
export const STALLED_RUNS_PER_CYCLE = 10;

export interface WorkerReport {
  processed: number;
  failed: number;
  deferred: number;
  rechecks: number;
  /** CPU gasta na chamada, quando o runtime expõe; aparece na resposta do cron para conferir a folga. */
  cpuMs?: number;
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
    // Adia `next_recheck_at` em vez de zerá-lo, e faz isso ANTES de criar o run (BER-59): se
    // `createRun`/`enqueueSteps` falhar depois, o pior caso é a rebusca atrasar 7 dias — nunca
    // o capítulo sumir de `dueRechecks` para sempre.
    await ctx.store.markRechecksScheduled(editionId, chapterNumbers, iso(ctx.now() + RECHECK_AFTER_MS));
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

/**
 * Run aberto sem passo ativo não avança sozinho (BER-59): o replanejamento só acontece depois de
 * executar um passo do run, e um passo que falhou como `worker_morreu`, ou um worker que morreu
 * entre o passo e o replanejamento, deixava o run em `running` para sempre, sem alerta. Publish
 * falho fecha o run como `failed`; qualquer outro caso é replanejado.
 */
export async function recoverStalledRuns(ctx: StepContext): Promise<void> {
  // Só run com mais de STALE_LOCK_MS de vida (BER-59): o `ingest-book` e o `scheduleRechecks` criam o
  // run e só depois enfileiram os passos; um worker sobreposto não pode replanejar nesse intervalo.
  const startedBefore = iso(ctx.now() - STALE_LOCK_MS);
  for (const run of await ctx.store.listStalledRuns(STALLED_RUNS_PER_CYCLE, startedBefore)) {
    try {
      const steps = await ctx.store.listSteps(run.id);
      if (steps.some((s) => s.kind === 'publish' && s.status === 'failed')) {
        await ctx.store.updateRun(run.id, { status: 'failed', statusReason: 'publish_falhou', finishedAt: iso(ctx.now()) });
        await ctx.notify('ingestion', `run ${run.id} terminou failed: publish_falhou`);
      } else {
        await advanceRun(run.id, ctx);
        // Run que o planejador não consegue mover (ex.: o `ingest-book` criou o run e falhou ao
        // enfileirar o passo `edition`) ficaria aberto para sempre, bloqueando novo pedido da
        // edição com 409 e ocupando vaga de recuperação a cada ciclo. Fecha e avisa (BER-59).
        const after = await ctx.store.listSteps(run.id);
        if (!after.some((s) => s.status === 'pending' || s.status === 'running')) {
          await ctx.store.updateRun(run.id, { status: 'failed', statusReason: 'run_sem_progresso', finishedAt: iso(ctx.now()) });
          await ctx.notify('ingestion', `run ${run.id} terminou failed: run_sem_progresso`);
        }
      }
    } catch (err) {
      // Um run com problema não pode parar o worker nem os outros runs.
      await ctx.notify('ingestion', `falha ao recuperar o run parado ${run.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function executeStep(step: StepRow, ctx: StepContext, executors: Record<StepKind, StepExecutor>, report: WorkerReport) {
  const run = await ctx.store.getRun(step.runId);
  if (run.status !== 'queued' && run.status !== 'running') {
    await ctx.store.finishStep(step.id, { status: 'done', payload: { ...step.payload, skipped: 'run_encerrado' } });
    return;
  }
  if (run.status === 'queued') await ctx.store.updateRun(run.id, { status: 'running' });

  // `claim_ingestion_steps` já contou esta execução (BER-59): um worker que morre no meio do
  // passo não deixa `attempts` para trás, e a trava velha com 4 tentativas vira `failed`.
  const attempts = step.attempts;
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
    // Saldo do provedor de IA acabou (BER-59): o passo não falhou, e marcar falha faria o run
    // inteiro se perder e ter de ser refeito depois da recarga. Volta para a fila sem gastar
    // tentativa, e a operação é avisada.
    if (err instanceof AIOutOfCreditsError) {
      await ctx.store.finishStep(step.id, {
        status: 'pending',
        nextAttemptAt: iso(ctx.now() + OUT_OF_CREDITS_RETRY_MS),
        attempts: step.attempts - 1,
      });
      await ctx.notify('ingestion', `run ${run.id}: ${err.message}; passos aguardando recarga`);
      report.deferred++;
      return;
    }
    if (err instanceof DeferStepError) {
      // Adiar não é tentar (BER-59): devolve a tentativa que a reivindicação contou, senão uma
      // cota diária esgotada várias vezes faria o passo falhar sem nunca ter falhado.
      await ctx.store.finishStep(step.id, { status: 'pending', nextAttemptAt: err.until, attempts: step.attempts - 1 });
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
    if (failure.status === 'failed') {
      report.failed++;
      // Só o último bloco da extração apagava o texto bruto (BER-59): no run local de 21/09/2026 a
      // página do Brasil Escola ficou guardada depois de o run fechar. Passo que não volta mais não
      // vai precisar do texto.
      const sourceId = sourceWithTextOf(step);
      if (sourceId) await ctx.store.deleteSourceText(sourceId);
    }
  }
}

/** Fonte cujo texto bruto o passo usa: extração (`fonte#bloco`) ou lote seguinte de um PDF. */
function sourceWithTextOf(step: StepRow): string | null {
  if (step.kind === 'extract') return step.subject.split('#')[0];
  if (step.kind === 'fetch' && typeof step.payload.continuacao === 'string') return step.payload.continuacao;
  return null;
}

export async function runWorker(ctx: StepContext, executors: Record<StepKind, StepExecutor> = EXECUTORS): Promise<WorkerReport> {
  const started = ctx.now();
  const report: WorkerReport = { processed: 0, failed: 0, deferred: 0, rechecks: 0 };

  // BER-59 (M4): limpeza de texto vencido e agendamento de rebusca não podem derrubar o ciclo
  // inteiro — um erro nelas não pode impedir os passos já na fila de serem processados.
  try {
    await ctx.store.deleteSourceTextsBefore(iso(started - SOURCE_TEXT_TTL_MS));
  } catch (err) {
    await ctx.notify('ingestion', `falha ao apagar texto bruto vencido: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    report.rechecks = await scheduleRechecks(ctx);
  } catch (err) {
    await ctx.notify('ingestion', `falha ao agendar rebuscas: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    await recoverStalledRuns(ctx);
  } catch (err) {
    await ctx.notify('ingestion', `falha ao recuperar runs parados: ${err instanceof Error ? err.message : String(err)}`);
  }

  const cpuStart = ctx.cpuMs();
  const cpuUsed = () => {
    const now = ctx.cpuMs();
    return cpuStart === null || now === null ? null : now - cpuStart;
  };
  while (ctx.now() - started < WORKER_TIME_BUDGET_MS && (cpuUsed() ?? 0) < WORKER_CPU_BUDGET_MS) {
    const steps = await ctx.store.claimSteps(CLAIM_BATCH, iso(ctx.now() - STALE_LOCK_MS));
    if (steps.length === 0) break;
    const touched = new Set<string>();
    for (const step of steps) {
      touched.add(step.runId);
      await executeStep(step, ctx, executors, report);
    }
    for (const runId of touched) await advanceRun(runId, ctx);
  }
  const cpu = cpuUsed();
  if (cpu !== null) report.cpuMs = Math.round(cpu);
  return report;
}
