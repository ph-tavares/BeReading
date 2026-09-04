// supabase/functions/retry-pending-quizzes/filter.ts
// O filtro do cron de retry, isolado para poder ser testado (BER-27).
//
// O filtro original era `and(status.eq.pending,last_attempt_at.lt.<cutoff>)`.
// Comparação com NULL em SQL nunca é verdadeira, então todo capítulo que jamais
// teve tentativa (`last_attempt_at IS NULL`) ficava invisível para o retry —
// exatamente os que mais precisavam dele. Na prática: 9 capítulos pendentes,
// 0 devolvidos pela query.

// BER-66: `failed` deixou de ser um motivo só. Capítulo sem conteúdo em
// `book_contents` também é gravado como `failed` (o CHECK da tabela não aceita
// status novo), mas com `error_message` prefixado por NO_CONTENT — e re-tentar
// esse caso é garantia de gastar invocação sem nunca mudar de resultado: o que
// falta é conteúdo, não uma nova chance da IA.
import { NO_CONTENT_ERROR_PREFIX } from '../_shared/content.ts';

/**
 * Monta o filtro `.or(...)` do PostgREST para os capítulos que merecem retry.
 *
 * @param cutoffIso instante ISO abaixo do qual um `pending` é considerado travado.
 */
export function buildPendingFilter(cutoffIso: string): string {
  // `not.like` sobre NULL não é verdadeiro, então o `error_message.is.null`
  // precisa entrar explicitamente — senão o filtro perderia todo `failed`
  // antigo, que é justamente o caso mais comum.
  const semNoContent =
    `or(error_message.is.null,error_message.not.like.${NO_CONTENT_ERROR_PREFIX}*)`;

  return [
    // Falhou explicitamente — menos o que falhou por falta de conteúdo.
    `and(status.eq.failed,${semNoContent})`,
    // Pendente e parado há tempo demais.
    `and(status.eq.pending,last_attempt_at.lt.${cutoffIso})`,
    // Pendente e NUNCA tentado — o caso que o filtro antigo perdia.
    'and(status.eq.pending,last_attempt_at.is.null)',
  ].join(',');
}
