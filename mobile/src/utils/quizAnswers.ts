import type { Answer, Question } from '../types/database';
import type { QuestionResult } from './quizUtils';

/**
 * BER-48: a resposta é imutável. Ao abrir um quiz já começado, a tela mostra o que o
 * leitor respondeu e a avaliação que recebeu, e começa na primeira pergunta aberta.
 */

/** O mesmo texto que o evaluate-answer devolve enquanto a IA não avaliou. */
export const PENDING_FEEDBACK = 'Resposta recebida! A avaliação ficará disponível em breve.';

type AnswerEvaluation = Pick<Answer, 'evaluation_status' | 'comprehension_score' | 'ai_feedback'>;

/** A avaliação de uma resposta salva, no formato dos cards de resultado. */
export function resultFromAnswer(answer: AnswerEvaluation): QuestionResult {
  if (answer.evaluation_status === 'completed' && answer.comprehension_score !== null) {
    return { score: answer.comprehension_score, feedback: answer.ai_feedback ?? '' };
  }
  // BER-42: sem nota não é nota zero.
  return { score: null, feedback: PENDING_FEEDBACK };
}

export interface ExistingQuizProgress {
  /** Resultado por índice da pergunta, só das que já têm resposta. */
  results: Record<number, QuestionResult>;
  /** O texto que o leitor escreveu, por índice da pergunta. */
  answerTexts: Record<number, string>;
  /** Primeira pergunta sem resposta; 0 quando tudo já foi respondido (revisão). */
  startIndex: number;
}

export function resultsFromExistingAnswers(
  questions: Pick<Question, 'id'>[],
  answers: (AnswerEvaluation & Pick<Answer, 'question_id' | 'answer_text'>)[],
): ExistingQuizProgress {
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  const results: Record<number, QuestionResult> = {};
  const answerTexts: Record<number, string> = {};

  questions.forEach((q, i) => {
    const answer = byQuestion.get(q.id);
    if (!answer) return;
    results[i] = resultFromAnswer(answer);
    answerTexts[i] = answer.answer_text;
  });

  const firstOpen = questions.findIndex((_, i) => !(i in results));
  return { results, answerTexts, startIndex: firstOpen === -1 ? 0 : firstOpen };
}
