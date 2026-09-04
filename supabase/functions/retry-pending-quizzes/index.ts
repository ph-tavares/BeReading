// supabase/functions/retry-pending-quizzes/index.ts
// Chamada pelo pg_cron de hora em hora. Cobre dois buracos do loop:
//   - capítulos cujo quiz nunca foi gerado (BER-27);
//   - respostas cuja avaliação falhou e ficava sem nota para sempre (BER-36).
//
// O nome ficou estreito depois da BER-36, mas renomear a function quebraria o
// agendamento do pg_cron — que só se conserta com migration, hoje inaplicável
// (BER-31). Melhor um nome apertado do que um cron que para de rodar.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { assertServiceRole, authErrorResponse } from '../_shared/auth.ts';
import { buildPendingFilter } from './filter.ts';
import {
  buildStaleEvaluationFilter,
  EVALUATION_BATCH_LIMIT,
  EVALUATION_GIVE_UP_AFTER_MS,
  EVALUATION_STUCK_AFTER_MS,
} from './answers-filter.ts';

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

Deno.serve(async (req) => {
  // Função interna: só o pg_cron (que manda a service_role key) entra. Ver BER-30.
  try {
    assertServiceRole(
      req.headers.get('Authorization'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
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

  return new Response(JSON.stringify({
    data: { retried, reevaluated },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
