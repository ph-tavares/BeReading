// supabase/functions/award-badges/index.ts
// Avalia e concede badges ao aluno após cada sessão de leitura.
// Chamado em fire-and-forget por register-reading-session.
import { createServiceClient } from '../_shared/supabase-client.ts';

export interface BadgeCriteria {
  id: string;
  name: string;
  criteria_type: string;
  criteria_value: number;
}

export interface StudentStats {
  total_sessions: number;
  current_streak: number;
  quizzes_answered: number;
  books_finished: number;
  reflection_scores_above_80: number;
  total_pages_read: number;
  has_personal_book: boolean;
  books_with_avg_score_above_90: number;
}

export function evaluateBadges(
  badges: BadgeCriteria[],
  stats: StudentStats,
  already_earned: string[]
): string[] {
  const earnedSet = new Set(already_earned);
  const newBadges: string[] = [];

  for (const badge of badges) {
    if (earnedSet.has(badge.id)) continue;

    let earned = false;

    switch (badge.criteria_type) {
      case 'total_sessions':
        earned = stats.total_sessions >= badge.criteria_value;
        break;
      case 'streak_days':
        earned = stats.current_streak >= badge.criteria_value;
        break;
      case 'quizzes_answered':
        earned = stats.quizzes_answered >= badge.criteria_value;
        break;
      case 'books_finished':
        earned = stats.books_finished >= badge.criteria_value;
        break;
      case 'reflection_score_80':
        earned = stats.reflection_scores_above_80 >= badge.criteria_value;
        break;
      case 'total_pages':
        earned = stats.total_pages_read >= badge.criteria_value;
        break;
      case 'personal_book':
        earned = stats.has_personal_book;
        break;
      case 'avg_score_90_book':
        earned = stats.books_with_avg_score_above_90 >= badge.criteria_value;
        break;
    }

    if (earned) newBadges.push(badge.id);
  }

  return newBadges;
}

async function fetchStudentStats(
  supabase: ReturnType<typeof createServiceClient>,
  student_id: string
): Promise<StudentStats> {
  const [sessionsResult, streakResult, answersResult, booksResult, classroomStudentResult] =
    await Promise.all([
      supabase.from('reading_sessions').select('pages_read').eq('student_id', student_id),
      supabase.from('streaks').select('current_streak').eq('student_id', student_id).single(),
      supabase
        .from('answers')
        .select('comprehension_score, questions(type, chapters(book_id))')
        .eq('student_id', student_id)
        .eq('evaluation_status', 'completed')
        .not('comprehension_score', 'is', null),
      supabase.from('student_books').select('book_id, status').eq('student_id', student_id),
      supabase.from('students').select('classroom_id').eq('id', student_id).single(),
    ]);

  const sessions = sessionsResult.data ?? [];
  const streak = streakResult.data;
  const answers = answersResult.data ?? [];
  const studentBooks = booksResult.data ?? [];
  const classroomStudent = classroomStudentResult.data;

  const total_sessions = sessions.length;
  const current_streak = streak?.current_streak ?? 0;
  const quizzes_answered = answers.length;
  const books_finished = studentBooks.filter(b => b.status === 'finished').length;
  const total_pages_read = sessions.reduce((sum, s) => sum + (s.pages_read ?? 0), 0);

  const reflection_scores_above_80 = answers.filter(
    (a: any) => a.questions?.type === 'reflection' && (a.comprehension_score ?? 0) > 80
  ).length;

  // Livro pessoal: livro do aluno que NÃO está na grade da turma
  let has_personal_book = false;
  if (classroomStudent) {
    const { data: classroomBookIds } = await supabase
      .from('classroom_books')
      .select('book_id')
      .eq('classroom_id', classroomStudent.classroom_id);

    const gradeBookIds = new Set(
      (classroomBookIds ?? []).map((cb: { book_id: string }) => cb.book_id)
    );
    has_personal_book = studentBooks.some(
      sb => !gradeBookIds.has(sb.book_id) && sb.status !== 'dropped'
    );
  }

  // Score médio >= 90 por livro finalizado — calculado com as respostas já buscadas
  const finishedBookIds = studentBooks
    .filter(b => b.status === 'finished')
    .map(b => b.book_id);

  let books_with_avg_score_above_90 = 0;
  for (const bookId of finishedBookIds) {
    const bookScores = answers
      .filter((a: any) => a.questions?.chapters?.book_id === bookId)
      .map((a: any) => a.comprehension_score as number);

    if (bookScores.length > 0) {
      const avg = bookScores.reduce((s: number, n: number) => s + n, 0) / bookScores.length;
      if (avg >= 90) books_with_avg_score_above_90++;
    }
  }

  return {
    total_sessions,
    current_streak,
    quizzes_answered,
    books_finished,
    reflection_scores_above_80,
    total_pages_read,
    has_personal_book,
    books_with_avg_score_above_90,
  };
}

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let student_id: string;
  try {
    const body = await req.json();
    student_id = body.student_id;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!student_id) {
    return new Response(JSON.stringify({ error: 'student_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

  const [{ data: allBadges }, { data: earnedBadges }] = await Promise.all([
    supabase.from('badges').select('id, name, criteria_type, criteria_value'),
    supabase.from('student_badges').select('badge_id').eq('student_id', student_id),
  ]);

  if (!allBadges) {
    return new Response(JSON.stringify({ data: { awarded: 0 }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const alreadyEarnedIds = (earnedBadges ?? []).map((b: { badge_id: string }) => b.badge_id);
  const stats = await fetchStudentStats(supabase, student_id);
  const newBadgeIds = evaluateBadges(allBadges, stats, alreadyEarnedIds);

  if (newBadgeIds.length === 0) {
    return new Response(JSON.stringify({ data: { awarded: 0 }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: insertError } = await supabase.from('student_badges').insert(
    newBadgeIds.map(badge_id => ({ student_id, badge_id }))
  );

  if (insertError) {
    console.error('Failed to insert student_badges:', insertError.message);
    return new Response(JSON.stringify({ error: 'Failed to award badges' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    data: { awarded: newBadgeIds.length, badge_ids: newBadgeIds },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
