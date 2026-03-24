// supabase/functions/retry-pending-quizzes/index.ts
// Called by pg_cron every hour to retry AI question generation for failed chapters.
import { createServiceClient } from '../_shared/supabase-client.ts';

const MAX_ATTEMPTS = 3;

Deno.serve(async (_req) => {
  const supabase = createServiceClient();

  // Buscar capítulos com quiz failed com menos de MAX_ATTEMPTS tentativas
  const { data: pending, error: queryError } = await supabase
    .from('chapter_quiz_status')
    .select('chapter_id, attempts')
    .eq('status', 'failed')
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
      await fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ chapter_id: item.chapter_id }),
      });
      retried++;
    } catch (err) {
      console.error(`Failed to retry chapter ${item.chapter_id}:`, err);
    }
  }

  return new Response(JSON.stringify({ data: { retried }, error: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
