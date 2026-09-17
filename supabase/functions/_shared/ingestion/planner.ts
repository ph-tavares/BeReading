// supabase/functions/_shared/ingestion/planner.ts
// Ordem das etapas de um run (BER-59, spec §3), decidida olhando os passos que existem, em
// vez de travas: `structure` espera a coleta terminar; `verify` espera a estrutura e a
// descoberta por capítulo; `publish` espera todas as verificações. Passo `failed` conta como
// terminado. O índice único (run_id, kind, subject) torna o replanejamento idempotente.
import type { RunStatus, StepKind, StepStatus } from './types.ts';

export interface StepView {
  kind: StepKind;
  subject: string;
  status: StepStatus;
}

export interface RunView {
  status: RunStatus;
  payload: { recheckChapters?: number[] };
}

export interface PlannedStep {
  kind: StepKind;
  subject: string;
  payload?: Record<string, unknown>;
}

const COLLECTION: StepKind[] = ['edition', 'discover', 'fetch', 'extract'];

export function planNextSteps(run: RunView, steps: StepView[], editionChapterNumbers: number[]): PlannedStep[] {
  if (run.status !== 'queued' && run.status !== 'running') return [];

  const active = (kinds: StepKind[]) => steps.some((s) => kinds.includes(s.kind) && (s.status === 'pending' || s.status === 'running'));
  const has = (kind: StepKind) => steps.some((s) => s.kind === kind);
  const terminal = (kind: StepKind) => steps.some((s) => s.kind === kind && (s.status === 'done' || s.status === 'failed'));

  if (has('publish')) return [];
  const recheck = run.payload.recheckChapters;

  if (!recheck) {
    if (steps.some((s) => s.kind === 'edition' && s.status === 'failed')) return [{ kind: 'publish', subject: '-' }];
    if (!has('structure')) {
      return terminal('edition') && !active(COLLECTION) ? [{ kind: 'structure', subject: '-' }] : [];
    }
    if (!terminal('structure')) return [];
  }

  if (!has('verify')) {
    if (active([...COLLECTION, 'structure'])) return [];
    const chapters = recheck ?? editionChapterNumbers;
    if (chapters.length === 0) return [{ kind: 'publish', subject: '-' }];
    return chapters.map((n) => ({ kind: 'verify' as const, subject: String(n) }));
  }

  return active(['verify']) ? [] : [{ kind: 'publish', subject: '-' }];
}
