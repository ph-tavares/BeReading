// src/utils/quizPolling.ts
// Ritmo do polling que espera a IA gerar as perguntas do capítulo.
//
// BER-40: eram 10 tentativas de 4s = 40s fixos, e ao estourar o app mostrava a MESMA
// tela de falha permanente ("😔 Perguntas indisponíveis") — logo depois da
// celebração de capítulo completo. Cold start da Edge Function + LLM sobre um
// capítulo inteiro passa de 40s com facilidade, então o aluno via "falhou" para um
// quiz que ficava pronto pouco depois.
//
// Duas mudanças: a janela cresce para ~2 minutos com intervalos progressivos (rápido
// no começo, espaçado depois — sem manter o app batendo de 4 em 4 segundos), e
// esgotar a janela deixa de significar "falhou": significa "ainda não ficou pronto".

/** Intervalos entre tentativas, em ms. O total define a janela de espera. */
export const POLL_SCHEDULE_MS: readonly number[] = [
  3000, 3000, 4000, 4000, 5000, 6000, 8000,
  10000, 12000, 15000, 20000, 20000, 20000,
];

/** Quantas tentativas o schedule permite. */
export const MAX_POLL_ATTEMPTS = POLL_SCHEDULE_MS.length;

/**
 * Espera antes da tentativa `attempt` (0-indexado).
 * Fora do schedule, mantém o último intervalo.
 */
export function pollDelayMs(attempt: number): number {
  if (attempt < 0) return POLL_SCHEDULE_MS[0];
  return POLL_SCHEDULE_MS[Math.min(attempt, POLL_SCHEDULE_MS.length - 1)];
}

/** Ainda vale esperar? */
export function shouldKeepPolling(attempt: number): boolean {
  return attempt < MAX_POLL_ATTEMPTS;
}

/** Janela total de espera, em ms. */
export function totalPollWindowMs(): number {
  return POLL_SCHEDULE_MS.reduce((sum, ms) => sum + ms, 0);
}
