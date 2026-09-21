import { supabase } from '../lib/supabase';
import { PENDING_FEEDBACK } from '../utils/quizAnswers';
import { parseQuotaExceeded, QuotaExceededError } from '../utils/billing';
import type { ScanFailure } from '../features/assistant/logic';
import type { StudentBook } from '../types/database';

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
  if (error) throw await quotaErrorOr(error);
  if (data.error) throw new Error(data.error);
  return data.data as RegisterReadingResponse;
}

/**
 * BER-48: as respostas do evaluate-answer que não são erro para o leitor.
 *
 * - 409: a pergunta já foi respondida (a resposta é imutável). O corpo traz a
 *   avaliação que ficou, e é ela que a tela mostra.
 * - 403 "Chapter not completed": o quiz ainda não abriu para este leitor.
 * - 402 `quota_exceeded` (BER-58): acabou a cota de quizzes do plano gratuito.
 *
 * @returns a avaliação existente no 409; `null` quando o erro não é um desses.
 * @throws Error com mensagem para o leitor no 403 de capítulo não lido.
 * @throws QuotaExceededError no 402, para a tela mostrar o convite ao Premium.
 */
export function interpretEvaluateFailure(
  status: number | undefined,
  body: unknown,
): EvaluateAnswerResponse | null {
  const payload = (body ?? {}) as {
    error?: string;
    data?: { score?: number | null; feedback?: string } | null;
  };

  const quota = parseQuotaExceeded(status, body);
  if (quota) throw new QuotaExceededError(quota);

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
export async function readHttpError(error: unknown): Promise<{ status?: number; body: unknown }> {
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

/** BER-58: o 402 de limite do plano vira `QuotaExceededError`; qualquer outro erro volta como veio. */
async function quotaErrorOr(error: unknown): Promise<unknown> {
  const { status, body } = await readHttpError(error);
  const quota = parseQuotaExceeded(status, body);
  return quota ? new QuotaExceededError(quota) : error;
}

export interface ReadingListResult {
  book_id: string;
  status: StudentBook['status'];
  current_page: number;
}

async function invokeReadingList(action: 'start' | 'stop', bookId: string): Promise<ReadingListResult> {
  const { data, error } = await supabase.functions.invoke('reading-list', {
    body: { action, book_id: bookId },
  });
  if (error) throw await quotaErrorOr(error);
  if (data.error) throw new Error(data.error);
  return data.data as ReadingListResult;
}

/**
 * BER-58: coloca o livro em leitura. Livro tirado da leitura antes volta da
 * página em que parou.
 *
 * @throws QuotaExceededError quando o plano gratuito já está no limite de livros.
 */
export function startReadingBook(bookId: string): Promise<ReadingListResult> {
  return invokeReadingList('start', bookId);
}

/** BER-58: tira o livro da leitura — libera a vaga e guarda a página. */
export function stopReadingBook(bookId: string): Promise<ReadingListResult> {
  return invokeReadingList('stop', bookId);
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

export interface ScanPageResult {
  conversation_id: string;
  page_text: string;
  suggestions: string[];
  detected_page: number | null;
  chapter_number: number | null;
  registered_page: number | null;
  book: { id: string; title: string; author: string } | null;
  book_title_text: string | null;
}

/**
 * BER-100: falha do `scan-page`, com o código que a tela usa para escolher a fala.
 * O texto que o leitor lê mora em `src/features/assistant/logic.ts`, não aqui.
 */
export class ScanPageError extends Error {
  constructor(readonly code: ScanFailure) {
    super(code);
    this.name = 'ScanPageError';
  }
}

/**
 * Traduz a resposta não-2xx do `scan-page` no código que a tela conhece.
 *
 * Um status sem corpo reconhecido vira `unknown` e não `scan_failed`: só chamamos
 * de falha nossa o que o servidor disse que é.
 */
export function interpretScanFailure(status: number | undefined, body: unknown): ScanFailure {
  const erro = (body as { error?: unknown } | null)?.error;
  if (typeof erro === 'string') {
    const conhecidos: ScanFailure[] = [
      'not_a_book_page', 'image_too_large', 'ai_image_unsupported', 'ai_unavailable', 'scan_failed',
    ];
    if ((conhecidos as string[]).includes(erro)) return erro as ScanFailure;
  }
  if (status === 413) return 'image_too_large';
  if (status === 422) return 'not_a_book_page';
  if (status === 503) return 'ai_unavailable';
  return 'unknown';
}

/**
 * BER-100: manda a foto da página e recebe transcrição, sugestões e a página detectada.
 *
 * A imagem sobe já redimensionada (ver `MAX_IMAGE_EDGE`) e não é gravada em lugar
 * nenhum — nem aqui, nem no servidor.
 *
 * @throws ScanPageError sempre que não der para seguir, com o código da falha.
 */
export async function scanPage(input: {
  imageBase64: string;
  imageMediaType: string;
  bookId?: string;
  bookTitle?: string;
}): Promise<ScanPageResult> {
  const { data, error } = await supabase.functions.invoke('scan-page', {
    body: {
      image_base64: input.imageBase64,
      image_media_type: input.imageMediaType,
      ...(input.bookId ? { book_id: input.bookId } : {}),
      ...(input.bookTitle ? { book_title: input.bookTitle } : {}),
    },
  });

  if (error) {
    const { status, body } = await readHttpError(error);
    // Sem resposta nenhuma do outro lado: o aparelho não chegou ao servidor.
    if (status === undefined) throw new ScanPageError('offline');
    throw new ScanPageError(interpretScanFailure(status, body));
  }
  if (!data?.data) throw new ScanPageError('unknown');
  return data.data as ScanPageResult;
}

/** BER-101: o que o assistente fez com a pergunta. O mesmo tipo que a function devolve. */
export type AnswerKind = 'direct' | 'invite' | 'refusal' | 'unknown';

export interface AskAssistantResult {
  conversation_id: string;
  kind: AnswerKind;
  answer: string;
}

/**
 * BER-101: manda a pergunta do leitor e recebe a resposta curta.
 *
 * Reaproveita o `ScanPageError`: do ponto de vista da tela, "não consegui ler sua
 * foto" e "não consegui responder agora" são a mesma classe de falha, com falas
 * diferentes. Um erro só evita dois caminhos de tratamento que nunca divergem.
 *
 * @throws ScanPageError com o código da falha.
 */
export async function askAssistant(input: {
  conversationId: string;
  question: string;
  /** De onde veio: a sugestão que a foto gerou, ou o campo de texto. */
  sourceKind: 'photo' | 'typed';
}): Promise<AskAssistantResult> {
  const { data, error } = await supabase.functions.invoke('ask-assistant', {
    body: {
      conversation_id: input.conversationId,
      question: input.question,
      source_kind: input.sourceKind,
    },
  });

  if (error) {
    const { status, body } = await readHttpError(error);
    if (status === undefined) throw new ScanPageError('offline');
    const codigo = (body as { error?: unknown } | null)?.error;
    if (codigo === 'ai_unavailable') throw new ScanPageError('ai_unavailable');
    if (status === 500) throw new ScanPageError('scan_failed');
    throw new ScanPageError('unknown');
  }
  if (!data?.data) throw new ScanPageError('unknown');
  return data.data as AskAssistantResult;
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
