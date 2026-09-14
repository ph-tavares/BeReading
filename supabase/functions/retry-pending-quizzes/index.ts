// supabase/functions/retry-pending-quizzes/index.ts
// Chamada pelo pg_cron de hora em hora. Cobre dois buracos do loop:
//   - capítulos cujo quiz nunca foi gerado (BER-27);
//   - respostas cuja avaliação falhou e ficava sem nota para sempre (BER-36).
//
// O nome ficou estreito depois da BER-36, mas renomear a function quebraria o
// agendamento do pg_cron — que só se conserta com migration, hoje inaplicável
// (BER-31). Melhor um nome apertado do que um cron que para de rodar.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { assertInternalCaller, authErrorResponse } from '../_shared/auth.ts';
import { acceptedCallerKeys } from './callers.ts';
import { buildPendingFilter } from './filter.ts';
import {
  buildStaleEvaluationFilter,
  EVALUATION_BATCH_LIMIT,
  EVALUATION_GIVE_UP_AFTER_MS,
  EVALUATION_STUCK_AFTER_MS,
} from './answers-filter.ts';
import { notifyOps } from '../_shared/ops-alert.ts';

const MAX_ATTEMPTS = 3;
const QUIZ_STUCK_AFTER_MS = 30 * 60 * 1000;

type SupabaseClient = ReturnType<typeof createServiceClient>;

interface Invoker {
  url: string;
  key: string;
}

/** POST em outra Edge Function com a service_role key. */
async function invoke(
  { url, key }: Invoker,
  fn: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[retry] ${fn} devolveu ${res.status} para ${JSON.stringify(body)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[retry] falha ao chamar ${fn} para ${JSON.stringify(body)}:`, err);
    return false;
  }
}

/** BER-27: capítulos com quiz `failed` ou `pending` travado. */
async function retryQuizGeneration(
  supabase: SupabaseClient,
  invoker: Invoker,
): Promise<number | null> {
  const stuckBefore = new Date(Date.now() - QUIZ_STUCK_AFTER_MS).toISOString();

  const { data: pending, error } = await supabase
    .from('chapter_quiz_status')
    .select('chapter_id')
    .or(buildPendingFilter(stuckBefore))
    .lt('attempts', MAX_ATTEMPTS);

  if (error) {
    console.error('Failed to query chapter_quiz_status:', error.message);
    return null;
  }

  let retried = 0;
  for (const item of pending ?? []) {
    if (await invoke(invoker, 'generate-questions', { chapter_id: item.chapter_id })) {
      retried++;
    }
  }
  return retried;
}

/**
 * BER-36: respostas que ficaram sem nota.
 *
 * O app dizia "a avaliação ficará disponível em breve" e ninguém nunca voltava —
 * o retry só olhava geração de perguntas. Sem nota, a resposta também não conta
 * para as medalhas, que filtram `completed`.
 */
async function retryPendingEvaluations(
  supabase: SupabaseClient,
  invoker: Invoker,
): Promise<number> {
  const now = Date.now();
  const stuckBefore = new Date(now - EVALUATION_STUCK_AFTER_MS).toISOString();
  const giveUpBefore = new Date(now - EVALUATION_GIVE_UP_AFTER_MS).toISOString();

  const { data: stale, error } = await supabase
    .from('answers')
    .select('id')
    .or(buildStaleEvaluationFilter(stuckBefore))
    // Teto de tentativas por tempo: sem coluna `attempts` em `answers` (migration,
    // inaplicável hoje), a idade da resposta é o limite. Ver answers-filter.ts.
    .gt('answered_at', giveUpBefore)
    .limit(EVALUATION_BATCH_LIMIT);

  if (error) {
    // Não derruba a execução: a parte dos capítulos já rodou e vale por si.
    console.error('Failed to query answers:', error.message);
    return 0;
  }

  let reevaluated = 0;
  for (const answer of stale ?? []) {
    if (await invoke(invoker, 'evaluate-answer', { answer_id: answer.id })) {
      reevaluated++;
    }
  }
  return reevaluated;
}

/**
 * BER-39: quanto ficou para trás de vez — não o que ainda vai ser re-tentado
 * (isso é o retry funcionando), mas o que já esgotou as tentativas e não vai se
 * curar sozinho. É esse número que precisa acordar alguém.
 */
async function countAbandoned(supabase: SupabaseClient, now: number): Promise<{ quizzes: number; answers: number }> {
  const { data: quizzes } = await supabase
    .from('chapter_quiz_status')
    .select('chapter_id')
    .neq('status', 'generated')
    .gte('attempts', MAX_ATTEMPTS);

  const giveUpBefore = new Date(now - EVALUATION_GIVE_UP_AFTER_MS).toISOString();
  const { data: answers } = await supabase
    .from('answers')
    .select('id')
    .neq('evaluation_status', 'completed')
    .lt('answered_at', giveUpBefore);

  return { quizzes: quizzes?.length ?? 0, answers: answers?.length ?? 0 };
}

// BER-49: exportada para que o teste de handler chame o código real, não uma
// cópia — o mesmo raciocínio da BER-35 para a lógica pura.
export async function handler(req: Request): Promise<Response> {
  // Função interna (BER-30): entra o pg_cron, com o CRON_SECRET que lê do Vault, ou
  // quem tiver a service_role. Ver callers.ts (BER-69 / BER-33).
  try {
    assertInternalCaller(
      req.headers.get('Authorization'),
      acceptedCallerKeys((name) => Deno.env.get(name)),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();
  const invoker: Invoker = { url: supabaseUrl, key: serviceRoleKey };

  const retried = await retryQuizGeneration(supabase, invoker);
  if (retried === null) {
    return new Response(JSON.stringify({ error: 'Query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reevaluated = await retryPendingEvaluations(supabase, invoker);

  // BER-39: item (2) da proposta — "cron diário que conta presos e alerta se >
  // 0" — sem agendar nada novo. Uma function nova exigiria mexer no pg_cron via
  // migration, inaplicável hoje (BER-31); este cron já roda de hora em hora.
  const abandoned = await countAbandoned(supabase, Date.now());
  if (abandoned.quizzes > 0 || abandoned.answers > 0) {
    await notifyOps(
      'retry-pending-quizzes',
      `${abandoned.quizzes} capítulo(s) e ${abandoned.answers} resposta(s) esgotaram as tentativas e não vão se resolver sozinhos.`,
    );
  }

  return new Response(JSON.stringify({
    data: { retried, reevaluated, abandoned },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
// Um teste que importa `handler` não pode abrir uma porta de verdade.
if (import.meta.main) Deno.serve(handler);
