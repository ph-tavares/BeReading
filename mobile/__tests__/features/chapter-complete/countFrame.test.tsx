// O quadro da contagem no instante t (F4-24).
//
// O Jest nao anima: o mock do Reanimated conclui o withTiming na hora. A prova
// de valor intermediario mora aqui, em funcao pura. A curva e a do token,
// avaliada pela mesma implementacao de Bezier que o Easing.bezier do Reanimated
// usa no aparelho (sem reimplementar a conta no teste), e as contas do quadro
// sao as de producao: o arco do Ring e o XP do centro.
import { motion } from '../../../src/theme/tokens';
import { ringProgressAt } from '../../../src/ui/Ring';
import { xpAt } from '../../../src/features/chapter-complete/logic';
import { levelFor } from '../../../src/game/xp';

// require, e nao import: o arquivo nao tem .d.ts no caminho que o TypeScript
// resolveria, e o tipo e so este.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Bezier } = require('react-native-reanimated/lib/module/Bezier') as {
  Bezier: (x1: number, y1: number, x2: number, y2: number) => (t: number) => number;
};

const curva = Bezier(...motion.count.easing);

describe('curva de motion.count (F4-24)', () => {
  it('vai de 0 a 1 nas bordas', () => {
    expect(curva(0)).toBeCloseTo(0, 5);
    expect(curva(1)).toBeCloseTo(1, 5);
  });
});

describe('arco do Ring no instante t', () => {
  const quadro = (t: number) => ringProgressAt(0.2, 0.8, curva(t));

  it('t = 0 sai do from, e t = 1 chega no to', () => {
    expect(quadro(0)).toBeCloseTo(0.2, 5);
    expect(quadro(1)).toBeCloseTo(0.8, 5);
  });

  it('ease-out: na metade do tempo ja passou da metade do caminho, sem chegar ao fim', () => {
    expect(quadro(0.5)).toBeGreaterThan(0.2 + 0.6 * 0.5);
    expect(quadro(0.5)).toBeLessThan(0.8);
  });

  it('perto do fim ainda esta abaixo do alvo, e a frente da metade', () => {
    expect(quadro(0.9)).toBeLessThan(0.8);
    expect(quadro(0.9)).toBeGreaterThan(quadro(0.5));
  });
});

describe('XP do centro no instante t', () => {
  const trecho = { fromProgress: 0, toProgress: 1, fromXp: 0, toXp: 10000, level: levelFor(0) };
  const quadro = (t: number) => xpAt(trecho, curva(t));

  it('t = 0 e o XP de antes, e t = 1 e o alvo', () => {
    expect(quadro(0)).toBe(0);
    expect(quadro(1)).toBe(10000);
  });

  it('ease-out: na metade do tempo ja passou da metade do XP, sem chegar ao alvo', () => {
    expect(quadro(0.5)).toBeGreaterThan(5000);
    expect(quadro(0.5)).toBeLessThan(10000);
  });

  it('perto do fim ainda esta abaixo do alvo', () => {
    expect(quadro(0.9)).toBeLessThan(10000);
    expect(quadro(0.9)).toBeGreaterThan(quadro(0.5));
  });
});
