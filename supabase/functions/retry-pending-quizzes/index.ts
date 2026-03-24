// supabase/functions/retry-pending-quizzes/index.ts
// Called by pg_cron every hour to retry AI question generation for failed chapters.
import { createServiceClient } from '../_shared/supabase-client.ts';

const MAX_ATTEMPTS = 3;

Deno.serve(async (_req) => {
  const supabase = createServiceClient();

  // Buscar capítulos com quiz failed ou pending travado (> 30 min sem atualização)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: pending, error: queryError } = await supabase
    .from('chapter_quiz_status')
    .select('chapter_id')
    .or(`status.eq.failed,and(status.eq.pending,last_attempt_at.lt.${thirtyMinutesAgo})`)
    .lt('attempts', MAX_ATTEMPTS);

  if (queryError) {
    console.error('Failed to query chapter_quiz_status:', queryError.message);
    return new Response(JSON.stringify({ error: 'Query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ data: { retried: 0 }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let retried = 0;
  for (const item of pending) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ chapter_id: item.chapter_id }),
      });
      if (res.ok) {
        retried++;
      } else {
        console.error(`generate-questions returned ${res.status} for chapter ${item.chapter_id}`);
      }
    } catch (err) {
      console.error(`Failed to retry chapter ${item.chapter_id}:`, err);
    }
  }

  return new Response(JSON.stringify({ data: { retried }, error: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
