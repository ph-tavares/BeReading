import { supabase } from '../lib/supabase';
import type {
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

export async function getStudentByUserId(userId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
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

export async function createStudent(
  userId: string,
  classroomId: string,
  displayName: string,
) {
  const { data, error } = await supabase
    .from('students')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ user_id: userId, classroom_id: classroomId, display_name: displayName } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStudentBooks(studentId: string): Promise<(StudentBook & { book: Book })[]> {
  const { data, error } = await supabase
    .from('student_books')
    .select('*, book:books(*)')
    .eq('student_id', studentId)
    .neq('status', 'dropped')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (StudentBook & { book: Book })[];
}

export async function getStreak(studentId: string): Promise<Streak | null> {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('student_id', studentId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getStudentBadges(studentId: string): Promise<(StudentBadge & { badge: Badge })[]> {
  const { data, error } = await supabase
    .from('student_badges')
    .select('*, badge:badges(*)')
    .eq('student_id', studentId)
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

export async function addBookToReadingList(studentId: string, bookId: string) {
  const { error } = await supabase
    .from('student_books')
    .upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { student_id: studentId, book_id: bookId, status: 'reading', current_page: 1 } as any,
      { onConflict: 'student_id,book_id' },
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
  studentId: string,
  chapterId: string,
): Promise<Answer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*, question:questions!inner(chapter_id)')
    .eq('student_id', studentId)
    .eq('question.chapter_id', chapterId);
  if (error) throw error;
  return (data ?? []) as Answer[];
}

export async function getReadingSessions(studentId: string): Promise<ReadingSession[]> {
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('read_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPendingQuizChapterIds(
  studentId: string,
  _classroomId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('chapter_id, answers!left(id, student_id)')
    .is('answers.id', null);
  if (error) throw error;
  return [...new Set((data ?? []).map((r: any) => r.chapter_id as string))];
}
