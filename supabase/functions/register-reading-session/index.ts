// supabase/functions/register-reading-session/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { dispatchBackground } from '../_shared/background.ts';
import type { ReadingSessionPayload } from '../_shared/types.ts';
// BER-35: a lógica pura vive em `reading.ts` para que o teste exercite o código
// real. Antes ficava aqui dentro, sem export, e o teste testava cópias suas.
import {
  findNewlyCompletedChapters,
  getMaxPageReached,
  getTodayInSaoPaulo,
  nextStreak,
} from './reading.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: ReadingSessionPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user_id: bodyUserId, book_id, start_page, end_page } = payload;

  const supabase = createServiceClient();

  // BER-30: o dono da ação é o JWT. O `user_id` do corpo continua sendo aceito
  // (o app manda), mas serve só para detectar tentativa de agir por outro.
  let user_id: string;
  try {
    user_id = await resolveUserId(
      req.headers.get('Authorization'),
      bodyUserId,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  // Validação básica
  if (!book_id || !start_page || !end_page) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (start_page < 1 || end_page < start_page) {
    return new Response(JSON.stringify({ error: 'Invalid page range' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const today = getTodayInSaoPaulo();

  // 1. Validar que o livro existe e que end_page <= total_pages
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('total_pages')
    .eq('id', book_id)
    .single();

  if (bookError || !book) {
    return new Response(JSON.stringify({ error: 'Book not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (end_page > book.total_pages) {
    return new Response(JSON.stringify({ error: 'end_page exceeds book total_pages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Buscar sessões anteriores para calcular progresso
  const { data: prevSessions } = await supabase
    .from('reading_sessions')
    .select('end_page')
    .eq('user_id', user_id)
    .eq('book_id', book_id);

  const previousMaxPage = getMaxPageReached(prevSessions ?? []);

  // 3. Criar ReadingSession
  const { error: sessionError } = await supabase
    .from('reading_sessions')
    .insert({ user_id, book_id, start_page, end_page });

  if (sessionError) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newMaxPage = Math.max(previousMaxPage, end_page);

  // 4. Atualizar (ou criar) StudentBook
  const { error: studentBookError } = await supabase
    .from('student_books')
    .upsert({
      user_id,
      book_id,
      current_page: newMaxPage,
      status: newMaxPage >= book.total_pages ? 'finished' : 'reading',
      ...(newMaxPage >= book.total_pages ? { finished_at: new Date().toISOString() } : {})
    }, { onConflict: 'user_id,book_id' });

  if (studentBookError) {
    console.error('Failed to upsert student_book:', studentBookError.message);
  }

  // 5. Atualizar Streak
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_read_date')
    .eq('user_id', user_id)
    .single();

  const { current: newCurrentStreak, longest: newLongestStreak } = nextStreak(streak, today);

  const { error: streakUpsertError } = await supabase
    .from('streaks')
    .upsert({
      user_id,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_read_date: today
    }, { onConflict: 'user_id' });

  if (streakUpsertError) {
    console.error('Failed to upsert streak:', streakUpsertError.message);
  }

  // 6. Detectar capítulos recém-completados
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, end_page')
    .eq('book_id', book_id)
    .order('number');

  const newlyCompleted = findNewlyCompletedChapters(
    chapters ?? [],
    previousMaxPage,
    newMaxPage
  );

  // 7. Para cada capítulo completo, disparar geração de perguntas (se ainda não gerado)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const completedChapterIds: string[] = [];
  for (const ch of newlyCompleted) {
    const { data: quizStatus } = await supabase
      .from('chapter_quiz_status')
      .select('status')
      .eq('chapter_id', ch.id)
      .single();

    if (!quizStatus || quizStatus.status === 'pending' || quizStatus.status === 'failed') {
      // BER-27: waitUntil mantém o worker vivo até o request sair. Sem isso o
      // disparo morria com o worker e o quiz nunca era gerado (attempts=0).
      if (supabaseUrl) {
        dispatchBackground('generate-questions', () =>
          fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ chapter_id: ch.id }),
          }));
      }
    }

    completedChapterIds.push(ch.id);
  }

  // 8. Disparar award-badges em segundo plano (BER-27)
  if (supabaseUrl) {
    dispatchBackground('award-badges', () =>
      fetch(`${supabaseUrl}/functions/v1/award-badges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ user_id }),
      }));
  }

  return new Response(JSON.stringify({
    data: {
      session_created: true,
      new_max_page: newMaxPage,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      completed_chapter_ids: completedChapterIds,
    },
    error: null
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
