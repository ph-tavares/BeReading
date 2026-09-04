// src/utils/quizStatus.ts
// Traduz o registro de `chapter_quiz_status` no estado que a tela do quiz mostra.
//
// BER-66: um capítulo sem conteúdo em `book_contents` não é erro de IA nem culpa
// do leitor — mas chegava aqui como `failed`, e a tela dizia "😔 Perguntas
// indisponíveis". Pior: antes da correção do backend, nem chegava, porque a IA
// inventava as perguntas a partir do título e o capítulo virava `generated`.
//
// O backend não pode gravar um status novo: o CHECK de `chapter_quiz_status` só
// aceita ('pending','generated','failed') e migration nova não é aplicável
// enquanto a BER-31 não destravar o backend. Por isso o caso vem como `failed`
// com `error_message` prefixado — o mesmo prefixo que
// `supabase/functions/generate-questions/prompt.ts` grava e que o cron de retry
// usa para não re-tentar.

import type { ChapterQuizStatus } from '../types/database';

/** Prefixo gravado pelo backend. Espelha NO_CONTENT_ERROR_PREFIX das Edge Functions. */
export const NO_CONTENT_ERROR_PREFIX = 'NO_CONTENT';

export type QuizScreenState = 'polling' | 'ready' | 'failed' | 'no-content';

/** O capítulo falhou por não ter conteúdo cadastrado? */
export function isNoContentStatus(status: ChapterQuizStatus | null | undefined): boolean {
  if (!status || status.status !== 'failed') return false;
  return (status.error_message ?? '').startsWith(NO_CONTENT_ERROR_PREFIX);
}

/**
 * Estado de tela para um registro de status.
 *
 * `ready` aqui significa "o backend diz que gerou" — a tela ainda confere se as
 * perguntas realmente vieram antes de mostrar o quiz.
 */
export function quizScreenStateFor(
  status: ChapterQuizStatus | null | undefined,
): QuizScreenState {
  if (isNoContentStatus(status)) return 'no-content';
  if (status?.status === 'generated') return 'ready';
  if (status?.status === 'failed') return 'failed';
  return 'polling';
}
