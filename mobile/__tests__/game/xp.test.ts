import { xpFromPages, xpFromScores, totalXp, levelFor, formatXp, XP_PER_PAGE, XP_PER_BADGE } from '../../src/game/xp';

const avaliada = (score: number) => ({ comprehension_score: score, evaluation_status: 'completed' });

describe('xpFromPages', () => {
  it('conta 5 XP por página, a mesma fórmula que a tela já mostrava', () => {
    expect(xpFromPages([{ pages_read: 28 }, { pages_read: 12 }])).toBe(40 * XP_PER_PAGE);
  });

  it('sem sessão, zero', () => {
    expect(xpFromPages([])).toBe(0);
  });
});

describe('xpFromScores', () => {
  it('conta nota dividida por 5, arredondada', () => {
    expect(xpFromScores([avaliada(92), avaliada(80)])).toBe(18 + 16);
  });

  it('resposta sem nota não conta — nota ausente não é nota zero (BER-42)', () => {
    expect(xpFromScores([
      { comprehension_score: null, evaluation_status: 'pending' },
      avaliada(90),
    ])).toBe(18);
  });

  it('resposta com status diferente de completed não conta, mesmo com nota', () => {
    expect(xpFromScores([{ comprehension_score: 90, evaluation_status: 'failed' }])).toBe(0);
  });
});

describe('totalXp', () => {
  it('soma páginas, notas e conquistas', () => {
    expect(totalXp({
      sessions: [{ pages_read: 10 }],
      answers: [avaliada(100)],
      badgeCount: 2,
    })).toBe(50 + 20 + 2 * XP_PER_BADGE);
  });
});

describe('levelFor', () => {
  it('começa no nível 1 com zero XP', () => {
    const r = levelFor(0);
    expect(r.level).toBe(1);
    expect(r.title).toBe('Primeira página');
    expect(r.progress).toBe(0);
  });

  it.each([
    [219, 1], [220, 2], [659, 2], [660, 3],
    [1319, 3], [1320, 4], [2199, 4], [2200, 5],
  ])('XP %i cai no nível %i', (xp, nivel) => {
    expect(levelFor(xp).level).toBe(nivel);
  });

  it('o nível 4 se chama Constante e mostra o piso e o próximo limiar', () => {
    const r = levelFor(1840);
    expect(r.title).toBe('Constante');
    expect(r.floor).toBe(1320);
    expect(r.next).toBe(2200);
  });

  it('progress é a fração entre o piso e o próximo limiar', () => {
    const r = levelFor(1760); // meio do caminho entre 1320 e 2200
    expect(r.progress).toBeCloseTo(0.5, 2);
  });

  it('do nível 8 em diante o título não muda e não há próximo limiar', () => {
    const r = levelFor(999_999);
    expect(r.title).toBe('Lenda da estante');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
  });

  it('XP negativo ou inválido não quebra: cai no nível 1', () => {
    expect(levelFor(-10).level).toBe(1);
    expect(levelFor(Number.NaN).level).toBe(1);
  });
});

// Veio de src/features/home/logic.ts (F4-22): Hoje, registro e conquista
// mostram XP, e a formatacao e do jogo, nao de uma tela.
describe('formatXp', () => {
  it('agrupa milhar com ponto, no padrao pt-BR', () => {
    expect(formatXp(1840)).toBe('1.840');
  });

  it('nao agrupa numero pequeno', () => {
    expect(formatXp(50)).toBe('50');
  });

  it('agrupa milhoes com dois pontos', () => {
    expect(formatXp(1234567)).toBe('1.234.567');
  });

  it('zero permanece zero', () => {
    expect(formatXp(0)).toBe('0');
  });
});
