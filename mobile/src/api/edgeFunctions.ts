import { supabase } from '../lib/supabase';
import { PENDING_FEEDBACK } from '../utils/quizAnswers';

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
  /** BER-48: a pergunta já tinha resposta; esta é a avaliação que ficou. */
  alreadyAnswered?: boolean;
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

/**
 * BER-48: as respostas do evaluate-answer que não são erro para o leitor.
 *
 * - 409: a pergunta já foi respondida (a resposta é imutável). O corpo traz a
 *   avaliação que ficou, e é ela que a tela mostra.
 * - 403 "Chapter not completed": o quiz ainda não abriu para este leitor.
 *
 * @returns a avaliação existente no 409; `null` quando o erro não é um desses.
 * @throws Error com mensagem para o leitor no 403 de capítulo não lido.
 */
export function interpretEvaluateFailure(
  status: number | undefined,
  body: unknown,
): EvaluateAnswerResponse | null {
  const payload = (body ?? {}) as {
    error?: string;
    data?: { score?: number | null; feedback?: string } | null;
  };

  if (status === 409) {
    return {
      score: payload.data?.score ?? null,
      feedback: payload.data?.feedback ?? PENDING_FEEDBACK,
      alreadyAnswered: true,
    };
  }
  if (status === 403 && payload.error === 'Chapter not completed') {
    throw new Error('Termine de ler este capítulo para responder o quiz.');
  }
  return null;
}

/** Status e corpo de um erro não-2xx do supabase-js (a resposta vem em `context`). */
async function readHttpError(error: unknown): Promise<{ status?: number; body: unknown }> {
  const context = (error as { context?: { status?: number; json?: () => Promise<unknown> } })
    ?.context;
  if (!context) return { body: null };
  let body: unknown = null;
  try {
    body = context.json ? await context.json() : null;
  } catch {
    body = null;
  }
  return { status: context.status, body };
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
  if (error) {
    const { status, body } = await readHttpError(error);
    const interpreted = interpretEvaluateFailure(status, body);
    if (interpreted) return interpreted;
    throw error;
  }
  if (data.error) throw new Error(data.error);
  return data.data as EvaluateAnswerResponse;
}

/**
 * BER-62: apaga o dado do leitor e a conta de login. Auto-serviço — o dono é
 * sempre quem está logado, nunca um id passado por fora.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data.error) throw new Error(data.error);
}
