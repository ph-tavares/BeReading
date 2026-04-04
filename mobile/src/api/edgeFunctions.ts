import { supabase } from '../lib/supabase';

export interface RegisterReadingResponse {
  session_created: boolean;
  new_max_page: number;
  current_streak: number;
  longest_streak: number;
  completed_chapter_ids: string[];
}

export interface EvaluateAnswerResponse {
  score: number | null;
  feedback: string;
}

export function buildRegisterReadingPayload(
  userId: string,
  bookId: string,
  startPage: number,
  endPage: number,
) {
  return { user_id: userId, book_id: bookId, start_page: startPage, end_page: endPage };
}

export function buildEvaluateAnswerPayload(
  questionId: string,
  userId: string,
  answerText: string,
) {
  const trimmed = answerText.trim();
  if (!trimmed) return null;
  return { question_id: questionId, user_id: userId, answer_text: trimmed };
}

export async function registerReadingSession(
  userId: string,
  bookId: string,
  startPage: number,
  endPage: number,
): Promise<RegisterReadingResponse> {
  const { data, error } = await supabase.functions.invoke('register-reading-session', {
    body: buildRegisterReadingPayload(userId, bookId, startPage, endPage),
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.data as RegisterReadingResponse;
}

export async function evaluateAnswer(
  questionId: string,
  userId: string,
  answerText: string,
): Promise<EvaluateAnswerResponse> {
  const payload = buildEvaluateAnswerPayload(questionId, userId, answerText);
  if (!payload) throw new Error('Resposta não pode estar vazia');

  const { data, error } = await supabase.functions.invoke('evaluate-answer', {
    body: payload,
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.data as EvaluateAnswerResponse;
}
