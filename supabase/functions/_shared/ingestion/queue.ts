// supabase/functions/_shared/ingestion/queue.ts
// Política de retry dos passos (BER-59, spec §7). Erro transitório (rede, timeout, 429,
// 5xx) tenta de novo com espera crescente; permanente falha na hora e o motivo fica no passo.

/** Retentativas depois da primeira execução. */
export const MAX_RETRIES = 3;
export const BACKOFF_MS = [60_000, 300_000, 1_800_000] as const;
/** Passo `running` travado há mais que isto era de um worker que morreu. */
export const STALE_LOCK_MS = 5 * 60_000;

export class HttpStatusError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Falha que tentar de novo não resolve (dado inválido, recurso inexistente). */
export class PermanentStepError extends Error {}

export function isTransientError(err: unknown): boolean {
  if (err instanceof PermanentStepError) return false;
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  if (err instanceof TypeError) return true;
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

/** `attempts` já conta a execução que acabou de falhar. */
export function afterFailure(
  attempts: number,
  transient: boolean,
  nowMs: number,
): { status: 'pending' | 'failed'; nextAttemptAt: string | null } {
  if (!transient || attempts > MAX_RETRIES) return { status: 'failed', nextAttemptAt: null };
  return { status: 'pending', nextAttemptAt: new Date(nowMs + BACKOFF_MS[attempts - 1]).toISOString() };
}

export function isStaleLock(lockedAt: string | null, nowMs: number): boolean {
  return lockedAt !== null && Date.parse(lockedAt) < nowMs - STALE_LOCK_MS;
}

export function startOfUtcDay(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** 00:05 UTC do dia seguinte: quando a cota diária do Tavily volta. */
export function nextUtcDay(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 5)).toISOString();
}
