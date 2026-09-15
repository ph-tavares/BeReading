// O que o XpRing chama na thread de UI precisa da diretiva 'worklet' (F4-24).
// Sem ela o aparelho quebra ao contar, e a suite nao percebe: o plugin do
// Reanimated fica desligado no Jest (babel.config.js) e o mock roda tudo
// sincrono no JS. Esta checagem e a rede entre o teste e o aparelho.
//
// Le o codigo-fonte, e nao `fn.toString()`: a transpilacao do Jest nao preserva
// a diretiva, e quem precisa dela e o plugin do Reanimated, que le a fonte.
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatXp } from '../../../src/game/xp';

const RAIZ = join(__dirname, '..', '..', '..');

function declaraWorklet(arquivo: string, funcao: string): boolean {
  const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');
  const assinatura = new RegExp(`export function ${funcao}\\([^)]*\\)[^{]*\\{\\s*'worklet';`);
  return assinatura.test(fonte);
}

describe('funcoes chamadas na thread de UI pelo XpRing', () => {
  it.each([
    ['src/features/chapter-complete/logic.ts', 'xpAt'],
    ['src/game/xp.ts', 'formatXp'],
    ['src/ui/Ring.tsx', 'ringProgressAt'],
  ])('%s: %s declara a diretiva worklet', (arquivo, funcao) => {
    expect(declaraWorklet(arquivo, funcao)).toBe(true);
  });
});

describe('formatXp sem regex (roda no runtime do worklet)', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1.000'],
    [12345, '12.345'],
    [1234567, '1.234.567'],
    [1320.6, '1.321'],
    [-1500, '-1.500'],
  ])('%p vira %p', (n, esperado) => {
    expect(formatXp(n)).toBe(esperado);
  });
});
