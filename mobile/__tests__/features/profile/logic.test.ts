import {
  badgeStatusLine, constancyWeeks, monogram, overallAverage, readDaysIn,
} from '../../../src/features/profile/logic';

// Terca, 15/09/2026, 12h em Sao Paulo.
const AGORA = new Date('2026-09-15T15:00:00.000Z');

describe('constancyWeeks', () => {
  it('12 semanas de segunda a domingo, terminando na semana corrente', () => {
    const semanas = constancyWeeks([], AGORA);
    expect(semanas).toHaveLength(12);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas[0][0].date).toBe('2026-06-29');
    expect(semanas[11][0].date).toBe('2026-09-14');
    expect(semanas[11][1]).toMatchObject({ date: '2026-09-15', future: false });
    expect(semanas[11][2]).toMatchObject({ date: '2026-09-16', future: true });
  });

  it('marca o dia pelo fuso de Sao Paulo, nao pelo UTC', () => {
    // 02h UTC do dia 15 = 23h do dia 14 em SP.
    const semanas = constancyWeeks([{ read_at: '2026-09-15T02:00:00.000Z' }], AGORA);
    expect(semanas[11][0].read).toBe(true);
    expect(semanas[11][1].read).toBe(false);
    expect(readDaysIn(semanas)).toBe(1);
  });

  it('sessao fora da janela nao conta', () => {
    expect(readDaysIn(constancyWeeks([{ read_at: '2026-01-10T15:00:00.000Z' }], AGORA))).toBe(0);
  });
});

describe('overallAverage', () => {
  it('media so das notas avaliadas; sem nota, null', () => {
    expect(overallAverage([
      { comprehension_score: 80, evaluation_status: 'completed' },
      { comprehension_score: 71, evaluation_status: 'completed' },
      { comprehension_score: null, evaluation_status: 'pending' },
    ])).toBe(76);
    expect(overallAverage([{ comprehension_score: null, evaluation_status: 'failed' }])).toBeNull();
  });
});

describe('badgeStatusLine', () => {
  it('conquistada mostra a data; em andamento, o progresso; sem conta, a descricao', () => {
    expect(badgeStatusLine({ earned: true, earnedAt: '2026-09-01T12:00:00.000Z', progress: null, description: 'd' }))
      .toMatch(/^Conquistada em \d/);
    expect(badgeStatusLine({ earned: false, earnedAt: null, progress: { current: 3, target: 7 }, description: 'd' }))
      .toBe('3 de 7');
    expect(badgeStatusLine({ earned: false, earnedAt: null, progress: null, description: 'Leia um livro fora da grade' }))
      .toBe('Leia um livro fora da grade');
  });
});

describe('monogram', () => {
  it('primeira letra em maiuscula, ou ? sem nome', () => {
    expect(monogram(' guilherme')).toBe('G');
    expect(monogram('')).toBe('?');
    expect(monogram(null)).toBe('?');
  });
});
