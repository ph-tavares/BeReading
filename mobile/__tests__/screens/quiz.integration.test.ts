/**
 * Testes de integração do fluxo Quiz.
 *
 * Este arquivo cobre a lógica de negócio extraída das telas quiz/[chapterId].tsx
 * e quiz/summary.tsx via utilitários puros em quizUtils.ts. A renderização das
 * telas tem testes próprios (quizSummary.test.tsx e os de src/features/quiz-chat).
 *
 * Cobertura por arquivo:
 *  - calcAverageScore      → __tests__/utils/quizUtils.test.ts
 *  - isAnswerSubmittable   → __tests__/utils/quizQuestion.logic.test.ts
 *  - isSubmitted           → __tests__/utils/quizQuestion.logic.test.ts
 *
 * A faixa de nota com emoji (getScoreConfig) saiu na F9; a fala da nota é a
 * scoreLine, coberta em __tests__/assistant/lines.test.ts.
 */

import { calcAverageScore } from '../../src/utils/quizUtils';

describe('Quiz flow: contrato de comportamento', () => {
  describe('navegação para summary', () => {
    it('calcula média corretamente antes de navegar', () => {
      // Simula 3 respostas avaliadas
      const results = [
        { score: 70, feedback: 'ok' },
        { score: 90, feedback: 'excelente' },
        { score: 80, feedback: 'bom' },
      ];
      expect(calcAverageScore(results)).toBe(80);
    });

    it('lida com respostas sem score (avaliação pendente)', () => {
      const results = [
        { score: null, feedback: 'sem score' },
        { score: 60, feedback: 'ok' },
      ];
      // BER-42: a pendente fica FORA da média em vez de entrar como zero.
      // Antes esperava 30, e o aluno perdia metade da nota por uma falha da IA.
      expect(calcAverageScore(results)).toBe(60);
    });
  });
});
