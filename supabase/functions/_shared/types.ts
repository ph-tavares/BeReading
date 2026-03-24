// supabase/functions/_shared/types.ts

export interface ReadingSessionPayload {
  student_id: string;
  book_id: string;
  start_page: number;
  end_page: number;
}

export interface CompletedChapter {
  chapter_id: string;
  number: number;
  book_id: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface QuestionData {
  type: 'comprehension' | 'reflection';
  question_text: string;
}

export interface AnswerPayload {
  question_id: string;
  student_id: string;
  answer_text: string;
}
