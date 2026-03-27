// supabase/functions/register-reading-session/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import type { ReadingSessionPayload } from '../_shared/types.ts';

const SAOPAULO_OFFSET = -3; // UTC-3

function getTodayInSaoPaulo(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const sp = new Date(utc + SAOPAULO_OFFSET * 3600000);
  return sp.toISOString().split('T')[0];
}

function getMaxPageReached(sessions: { end_page: number }[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map(s => s.end_page));
}

function findNewlyCompletedChapters(
  chapters: { id: string; end_page: number }[],
  previousMaxPage: number,
  newMaxPage: number
) {
  return chapters.filter(
    ch => ch.end_page > previousMaxPage && ch.end_page <= newMaxPage
  );
}

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

  const { student_id, book_id, start_page, end_page } = payload;

  // Validação básica
  if (!student_id || !book_id || !start_page || !end_page) {
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

  const supabase = createServiceClient();
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
    .eq('student_id', student_id)
    .eq('book_id', book_id);

  const previousMaxPage = getMaxPageReached(prevSessions ?? []);

  // 3. Criar ReadingSession
  const { error: sessionError } = await supabase
    .from('reading_sessions')
    .insert({ student_id, book_id, start_page, end_page });

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
      student_id,
      book_id,
      current_page: newMaxPage,
      status: newMaxPage >= book.total_pages ? 'finished' : 'reading',
      ...(newMaxPage >= book.total_pages ? { finished_at: new Date().toISOString() } : {})
    }, { onConflict: 'student_id,book_id' });

  if (studentBookError) {
    console.error('Failed to upsert student_book:', studentBookError.message);
  }

  // 5. Atualizar Streak
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_read_date')
    .eq('student_id', student_id)
    .single();

  let newCurrentStreak = 1;
  let newLongestStreak = 1;

  if (streak) {
    const lastDate = streak.last_read_date;
    if (lastDate === today) {
      // Já leu hoje — não altera streak
      newCurrentStreak = streak.current_streak;
      newLongestStreak = streak.longest_streak;
    } else {
      const last = new Date(lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / 86400000);
      newCurrentStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
      newLongestStreak = Math.max(newCurrentStreak, streak.longest_streak);
    }
  }

  const { error: streakUpsertError } = await supabase
    .from('streaks')
    .upsert({
      student_id,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_read_date: today
    }, { onConflict: 'student_id' });

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
      // Disparar generate-questions (fire-and-forget)
      if (supabaseUrl) {
        fetch(`${supabaseUrl}/functions/v1/generate-questions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ chapter_id: ch.id }),
        }).catch(() => {}); // fire-and-forget, fallback via pg_cron
      }
    }

    completedChapterIds.push(ch.id);
  }

  // 8. Disparar award-badges (fire-and-forget)
  if (supabaseUrl) {
    fetch(`${supabaseUrl}/functions/v1/award-badges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ student_id }),
    }).catch(() => {});
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
