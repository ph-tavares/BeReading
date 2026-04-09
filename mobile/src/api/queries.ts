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

export async function getBooks(search?: string): Promise<Book[]> {
  let query = supabase.from('books').select('*').order('title');
  if (search) query = query.ilike('title', `%${search}%`);
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

export async function addBookToReadingList(userId: string, bookId: string) {
  const { error } = await supabase
    .from('student_books')
    .upsert(
      { user_id: userId, book_id: bookId, status: 'reading', current_page: 1 } as any,
      { onConflict: 'user_id,book_id' },
    );
  if (error) throw error;
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
