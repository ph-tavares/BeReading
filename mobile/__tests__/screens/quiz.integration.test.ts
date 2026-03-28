/**
 * Testes de integração do fluxo Quiz.
 *
 * LIMITAÇÃO: jest-expo canary (SDK 55) tem o ambiente react-native quebrado
 * para renderização de componentes. Testes de UI são feitos manualmente no simulador.
 *
 * Este arquivo cobre a lógica de negócio extraída das telas quiz/[chapterId].tsx
 * e quiz/summary.tsx via utilitários puros em quizUtils.ts.
 *
 * Cobertura por arquivo:
 *  - calcAverageScore      → __tests__/utils/quizUtils.test.ts (5 casos)
 *  - getScoreConfig        → __tests__/utils/quizUtils.test.ts (6 casos)
 *  - isAnswerSubmittable   → __tests__/utils/quizQuestion.logic.test.ts (3 casos)
 *  - isSubmitted           → __tests__/utils/quizQuestion.logic.test.ts (4 casos)
 */

import { calcAverageScore, getScoreConfig } from '../../src/utils/quizUtils';

describe('Quiz flow — contrato de comportamento', () => {
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
      // score null tratado como 0
      expect(calcAverageScore(results)).toBe(30);
    });
  });

  describe('tela summary — faixa de score', () => {
    it('score 80+ → emoji 🏆', () => {
      expect(getScoreConfig(80).emoji).toBe('🏆');
    });

    it('score 60-79 → emoji ✅', () => {
      expect(getScoreConfig(60).emoji).toBe('✅');
    });

    it('score <60 → emoji 📚', () => {
      expect(getScoreConfig(59).emoji).toBe('📚');
    });
  });
});
