// supabase/functions/process-ingestion/index.ts
// BER-59: worker da ingestão, chamado pelo pg_cron a cada minuto
// (migration 20260918130000_ber59_cron_process_ingestion.sql). Aceita a chave de servidor
// (operação manual) e o CRON_SECRET, que o cron lê do Vault — o mesmo desenho do
// retry-pending-quizzes (BER-33, BER-84).
import { assertInternalCaller, authErrorResponse } from '../_shared/auth.ts';
import { ingestionDisabled } from '../_shared/ingestion/kill-switch.ts';
import { buildProductionContext } from '../_shared/ingestion/production-context.ts';
import type { StepContext } from '../_shared/ingestion/steps/context.ts';
import { runWorker } from '../_shared/ingestion/worker.ts';
import { internalCallerKeys } from '../_shared/keys.ts';
import { notifyOps } from '../_shared/ops-alert.ts';

export interface ProcessIngestionDeps {
  context: () => StepContext;
  getEnv: (name: string) => string | undefined;
}

const defaultDeps: ProcessIngestionDeps = {
  context: buildProductionContext,
  getEnv: (name) => Deno.env.get(name),
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handler(req: Request, deps: ProcessIngestionDeps = defaultDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    assertInternalCaller(req.headers, [...internalCallerKeys(deps.getEnv), deps.getEnv('CRON_SECRET')]);
  } catch (err) {
    return authErrorResponse(err);
  }

  if (ingestionDisabled(deps.getEnv('INGESTION_ENABLED'))) {
    return json(200, { data: { skipped: 'INGESTION_ENABLED=false' }, error: null });
  }

  try {
    const report = await runWorker(deps.context());
    return json(200, { data: report, error: null });
  } catch (err) {
    await notifyOps('process-ingestion', `worker falhou: ${err instanceof Error ? err.message : err}`);
    return json(500, { error: 'Worker failed' });
  }
}

if (import.meta.main) Deno.serve((req) => handler(req));
