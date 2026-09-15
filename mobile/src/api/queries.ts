import { supabase } from '../lib/supabase';
import type {
  Profile,
  Book,
  StudentBook,
  Question,
  Answer,
  Streak,
  Badge,
  StudentBadge,
  Classroom,
  Chapter,
  ChapterQuizStatus,
  ReadingSession,
} from '../types/database';
import { filterReachedChapters } from '../utils/pendingQuizzes';
import { resultsFromExistingAnswers, type ExistingQuizProgress } from '../utils/quizAnswers';

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createProfile(userId: string, displayName: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, display_name: displayName })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getClassroomByCode(code: string): Promise<Classroom | null> {
  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('class_code', code.trim())
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function joinClassroom(userId: string, code: string): Promise<Profile> {
  const classroom = await getClassroomByCode(code);
  if (!classroom) throw new Error('Turma não encontrada');
  const { data, error } = await supabase
    .from('profiles')
    .update({ classroom_id: classroom.id })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getStudentBooks(userId: string): Promise<(StudentBook & { book: Book })[]> {
  const { data, error } = await supabase
    .from('student_books')
    .select('*, book:books(*)')
    .eq('user_id', userId)
    .neq('status', 'dropped')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (StudentBook & { book: Book })[];
}

/**
 * Até que página o leitor chegou neste livro (BER-48). O register-reading-session
 * grava `student_books.current_page` com a maior página registrada, a mesma conta
 * que o servidor usa para liberar o quiz. Sem registro nenhum, 0.
 */
export async function getCurrentPage(userId: string, bookId: string): Promise<number> {
  const { data, error } = await supabase
    .from('student_books')
    .select('current_page')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data?.current_page ?? 0;
}

export async function getStreak(userId: string): Promise<Streak | null> {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getStudentBadges(userId: string): Promise<(StudentBadge & { badge: Badge })[]> {
  const { data, error } = await supabase
    .from('student_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (StudentBadge & { badge: Badge })[];
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase.from('badges').select('*');
  if (error) throw error;
  return data ?? [];
}

/**
 * Escapa o valor de dentro de um filtro `.or()` do PostgREST.
 *
 * `.or()` recebe uma string só, que o próprio PostgREST despedaça por vírgula
 * (separador de condições) e parênteses (agrupamento/`in`). Interpolar o termo
 * de busca cru deixaria `"Machado, Assis"` virar duas condições, ou um `)`
 * a mais reabrir a sintaxe de agrupamento — não é vazamento de dado de outro
 * usuário (RLS continua valendo, e o catálogo é público), mas quebra ou
 * distorce o resultado.
 *
 * A saída do PostgREST para isso é aspar o valor: dentro de aspas duplas, `,`
 * e `(`/`)` deixam de ser separadores e viram texto literal. Dentro das aspas,
 * os dois caracteres que ainda têm significado são a própria aspa e a barra
 * invertida — por isso só esses dois são escapados aqui.
 */
function escapeOrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function getBooks(search?: string): Promise<Book[]> {
  let query = supabase.from('books').select('*').order('title');
  if (search) {
    const safe = escapeOrValue(search);
    query = query.or(`title.ilike."%${safe}%",author.ilike."%${safe}%"`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getClassroomBooks(classroomId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('classroom_books')
    .select('book:books(*)')
    .eq('classroom_id', classroomId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.book) as Book[];
}

// BER-58: `addBookToReadingList` saiu daqui. Começar e tirar livro da leitura
// passa pela Edge Function `reading-list` (ver api/edgeFunctions.ts), que aplica
// o limite de livros simultâneos do plano gratuito.

/**
 * Status e página do leitor neste livro, incluindo livro tirado da leitura
 * (`dropped`) — `getStudentBooks` esconde esses. `null` = nunca começou.
 */
export async function getStudentBookEntry(
  userId: string,
  bookId: string,
): Promise<Pick<StudentBook, 'status' | 'current_page'> | null> {
  const { data, error } = await supabase
    .from('student_books')
    .select('status, current_page')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBookWithChapters(bookId: string): Promise<(Book & { chapters: Chapter[] }) | null> {
  const { data, error } = await supabase
    .from('books')
    .select('*, chapters(*)')
    .eq('id', bookId)
    .single();
  if (error) throw error;
  return data as Book & { chapters: Chapter[] };
}

export async function getChapterQuizStatus(chapterId: string): Promise<ChapterQuizStatus | null> {
  const { data, error } = await supabase
    .from('chapter_quiz_status')
    .select('*')
    .eq('chapter_id', chapterId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getQuestionsForChapter(chapterId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('chapter_id', chapterId);
  if (error) throw error;
  return data ?? [];
}

export async function getStudentAnswersForChapter(
  userId: string,
  chapterId: string,
): Promise<Answer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*, question:questions!inner(chapter_id)')
    .eq('user_id', userId)
    .eq('question.chapter_id', chapterId);
  if (error) throw error;
  return (data ?? []) as Answer[];
}

/** Resposta do leitor com o `chapter_id` (via join) que o progressStore precisa. */
export type MyAnswer = Answer & { question: { chapter_id: string } };

/**
 * Todas as respostas do próprio leitor — o que alimenta o XP derivado em
 * `src/game/xp.ts` (`comprehension_score`, `evaluation_status`) e, via o join,
 * o `chapter_id` de cada uma. Só leitura, mesmo formato de consulta que
 * `getStudentAnswersForChapter`: a RLS já libera porque o filtro é sempre pelo
 * próprio `user_id`.
 */
export async function getMyAnswers(userId: string): Promise<MyAnswer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*, question:questions!inner(chapter_id)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as MyAnswer[];
}

/**
 * Perguntas do capítulo + o que este leitor já respondeu (BER-48). A resposta é
 * imutável, então o quiz reabre mostrando as avaliações e começa na primeira
 * pergunta aberta. Se as respostas não carregarem, abre como quiz novo: o servidor
 * ainda recusa a repetição com 409 e devolve a avaliação que ficou.
 */
export async function loadQuizForReader(
  chapterId: string,
  userId: string | undefined,
): Promise<{ questions: Question[]; progress: ExistingQuizProgress }> {
  const questions = await getQuestionsForChapter(chapterId);
  let answers: Answer[] = [];
  if (userId) {
    try {
      answers = await getStudentAnswersForChapter(userId, chapterId);
    } catch {
      answers = [];
    }
  }
  return { questions, progress: resultsFromExistingAnswers(questions, answers) };
}

export async function getReadingSessions(userId: string): Promise<ReadingSession[]> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('read_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPendingQuizChapterIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('chapter_id, answers!left(id, user_id)')
    .eq('answers.user_id', userId)
    .is('answers.id', null);
  if (error) throw error;
  return [...new Set((data ?? []).map((r: any) => r.chapter_id as string))];
}

/**
 * Capítulos por id, com o que basta para saber se o leitor chegou neles.
 *
 * BER-54: usada com `getPendingQuizChapterIds`, que sozinha devolve todo capítulo
 * com pergunta gerada e sem resposta deste usuário — inclusive de livros que ele
 * nunca abriu. Ver `src/utils/pendingQuizzes.ts`.
 */
export async function getChaptersByIds(ids: string[]): Promise<Chapter[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as Chapter[];
}

/**
 * Quizzes que o leitor deixou para depois (BER-54).
 *
 * Junta as três coisas necessárias para a resposta ser honesta: os capítulos com
 * pergunta e sem resposta dele, os dados desses capítulos, e até onde ele leu em
 * cada livro. Sem o último filtro, o card na Home anunciaria quizzes de livros
 * que a pessoa nunca abriu.
 */
export async function loadPendingQuizzes(
  userId: string,
  studentBooks: StudentBook[],
): Promise<Chapter[]> {
  const ids = await getPendingQuizChapterIds(userId);
  if (ids.length === 0) return [];
  const chapters = await getChaptersByIds(ids);
  return filterReachedChapters(chapters, studentBooks);
}
