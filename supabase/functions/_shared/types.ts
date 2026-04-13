// supabase/functions/_shared/types.ts

export interface ReadingSessionPayload {
  user_id: string;
  book_id: string;
  start_page: number;
  end_page: number;
}

export interface CompletedChapter {
  chapter_id: string;
  chapter_number: number; // DB column is 'number' — query sites must alias: chapter_number: ch.number
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
  user_id: string;
  answer_text: string;
}
