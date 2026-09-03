import {
  getScoreConfig,
  calcAverageScore,
  countPendingEvaluations,
} from '../../src/utils/quizUtils';

describe('getScoreConfig', () => {
  it('retorna troféu para score >= 80', () => {
    expect(getScoreConfig(80).emoji).toBe('🏆');
    expect(getScoreConfig(100).emoji).toBe('🏆');
    expect(getScoreConfig(95).emoji).toBe('🏆');
  });

  it('retorna check para score entre 60 e 79', () => {
    expect(getScoreConfig(60).emoji).toBe('✅');
    expect(getScoreConfig(79).emoji).toBe('✅');
    expect(getScoreConfig(70).emoji).toBe('✅');
  });

  it('retorna livro para score < 60', () => {
    expect(getScoreConfig(59).emoji).toBe('📚');
    expect(getScoreConfig(0).emoji).toBe('📚');
    expect(getScoreConfig(30).emoji).toBe('📚');
  });

  it('retorna cor verde para score >= 80', () => {
    expect(getScoreConfig(80).color).toBe('#10B981');
  });

  it('retorna cor índigo para score 60-79', () => {
    expect(getScoreConfig(60).color).toBe('#4F46E5');
  });

  it('retorna cor âmbar para score < 60', () => {
    expect(getScoreConfig(0).color).toBe('#F59E0B');
  });

  it('retorna label e message não-vazios para qualquer score', () => {
    [0, 60, 80, 100].forEach((score) => {
      const cfg = getScoreConfig(score);
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.message.length).toBeGreaterThan(0);
    });
  });
});

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
