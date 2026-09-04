// supabase/functions/retry-pending-quizzes/answers-filter.ts
// BER-36: uma resposta cuja avaliação falha fica sem nota para sempre. O app diz
// "a avaliação ficará disponível em breve" e ninguém nunca volta para avaliar —
// o único retry que existia olhava geração de perguntas, nunca `answers`. Além da
// nota que não chega, as medalhas que filtram `completed` também nunca contam.
//
// O retry vive aqui dentro do cron que já existe, e não numa function nova, por
// um motivo prático: agendar uma nova exigiria mexer no pg_cron, ou seja, uma
// migration — e migration não é aplicável enquanto a BER-31 não destravar o
// backend. O cron de hora em hora já está de pé.

/** Uma avaliação `pending` só é considerada travada depois disto. */
export const EVALUATION_STUCK_AFTER_MS = 10 * 60 * 1000; // 10 min

/**
 * Idade a partir da qual o retry desiste da resposta.
 *
 * Serve de limite de tentativas: com o cron de hora em hora, são ~6 tentativas.
 * O limite correto seria uma coluna `attempts` em `answers`, como o
 * `chapter_quiz_status` tem — mas isso é migration, que hoje não é aplicável
 * (BER-31). Enquanto isso, o teto é por tempo.
 */
export const EVALUATION_GIVE_UP_AFTER_MS = 6 * 60 * 60 * 1000; // 6 h

/** Quantas respostas re-avaliar por execução, para não estourar custo de IA. */
export const EVALUATION_BATCH_LIMIT = 20;

/**
 * Filtro `.or(...)` do PostgREST para respostas que merecem nova avaliação.
 *
 * @param stuckBeforeIso instante abaixo do qual uma `pending` é considerada travada.
 */
export function buildStaleEvaluationFilter(stuckBeforeIso: string): string {
  return [
    // Falhou explicitamente na avaliação.
    'evaluation_status.eq.failed',
    // Ficou presa em pending — a function morreu antes de concluir.
    `and(evaluation_status.eq.pending,answered_at.lt.${stuckBeforeIso})`,
  ].join(',');
}
