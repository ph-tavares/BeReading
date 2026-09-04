// supabase/functions/retry-pending-quizzes/filter.ts
// O filtro do cron de retry, isolado para poder ser testado (BER-27).
//
// O filtro original era `and(status.eq.pending,last_attempt_at.lt.<cutoff>)`.
// Comparação com NULL em SQL nunca é verdadeira, então todo capítulo que jamais
// teve tentativa (`last_attempt_at IS NULL`) ficava invisível para o retry —
// exatamente os que mais precisavam dele. Na prática: 9 capítulos pendentes,
// 0 devolvidos pela query.

/**
 * Monta o filtro `.or(...)` do PostgREST para os capítulos que merecem retry.
 *
 * @param cutoffIso instante ISO abaixo do qual um `pending` é considerado travado.
 */
export function buildPendingFilter(cutoffIso: string): string {
  return [
    // Falhou explicitamente.
    'status.eq.failed',
    // Pendente e parado há tempo demais.
    `and(status.eq.pending,last_attempt_at.lt.${cutoffIso})`,
    // Pendente e NUNCA tentado — o caso que o filtro antigo perdia.
    'and(status.eq.pending,last_attempt_at.is.null)',
  ].join(',');
}
