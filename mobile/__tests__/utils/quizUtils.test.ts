import {
  calcAverageScore,
  countPendingEvaluations,
} from '../../src/utils/quizUtils';

// getScoreConfig saiu na F9 com os seus testes: a fala da nota e a scoreLine,
// coberta em __tests__/assistant/lines.test.ts.

describe('calcAverageScore', () => {
  it('retorna null para array vazio (nao ha media, e isso nao e zero)', () => {
    expect(calcAverageScore([])).toBeNull();
  });

  it('retorna o score quando há apenas um resultado', () => {
    expect(calcAverageScore([{ score: 80, feedback: '' }])).toBe(80);
  });

  it('calcula média corretamente', () => {
    expect(calcAverageScore([
      { score: 60, feedback: '' },
      { score: 80, feedback: '' },
      { score: 100, feedback: '' },
    ])).toBe(80);
  });

  it('arredonda o resultado', () => {
    expect(calcAverageScore([
      { score: 70, feedback: '' },
      { score: 71, feedback: '' },
    ])).toBe(71); // 70.5 → 71
  });

  // BER-42: este teste travava o bug. Uma resposta ainda nao avaliada entrava na
  // conta como zero e derrubava a media em ~25 pontos num quiz de 4 perguntas.
  it('IGNORA score null em vez de tratar como 0', () => {
    expect(calcAverageScore([
      { score: null, feedback: '' },
      { score: 100, feedback: '' },
    ])).toBe(100);
  });

  it('retorna null quando nenhuma resposta foi avaliada ainda', () => {
    expect(calcAverageScore([
      { score: null, feedback: '' },
      { score: null, feedback: '' },
    ])).toBeNull();
  });
});

describe('countPendingEvaluations', () => {
  it('conta as respostas sem nota', () => {
    expect(countPendingEvaluations([
      { score: 80, feedback: '' },
      { score: null, feedback: '' },
      { score: null, feedback: '' },
    ])).toBe(2);
  });

  it('retorna 0 quando todas foram avaliadas', () => {
    expect(countPendingEvaluations([{ score: 80, feedback: '' }])).toBe(0);
  });
});
