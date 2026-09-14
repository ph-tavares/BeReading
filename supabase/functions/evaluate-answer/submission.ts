// supabase/functions/evaluate-answer/submission.ts
// BER-48: uma resposta por pergunta, e ela não se reescreve.
//
// Era upsert em (question_id, user_id): refazer o quiz apagava a resposta e a nota
// anteriores em silêncio, e dava para tentar até gostar da nota. Agora é insert, e
// o UNIQUE que o banco já tem resolve a corrida: quem chega em segundo recebe 409
// com a avaliação que já existe.

/** O texto que o app mostra enquanto a IA não avaliou. Não mudou. */
export const PENDING_FEEDBACK = 'Resposta recebida! A avaliação ficará disponível em breve.';

/** O erro é o UNIQUE (question_id, user_id), ou seja, resposta repetida? */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

export interface ExistingAnswer {
  evaluation_status: string;
  comprehension_score: number | null;
  ai_feedback: string | null;
}

/** A avaliação de uma resposta que já existe, no formato que o app entende. */
export function existingAnswerResult(answer: ExistingAnswer): {
  score: number | null;
  feedback: string;
} {
  if (answer.evaluation_status === 'completed' && answer.comprehension_score !== null) {
    return { score: answer.comprehension_score, feedback: answer.ai_feedback ?? '' };
  }
  // BER-42: sem nota não é nota zero.
  return { score: null, feedback: PENDING_FEEDBACK };
}
