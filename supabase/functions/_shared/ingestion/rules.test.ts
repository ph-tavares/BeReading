import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  bestWeightPerGroup,
  chapterConfidence,
  chapterStatus,
  factConfidence,
  isConfirmed,
  MIN_FACTS_CONFIRMED,
  resolveContradiction,
} from './rules.ts';
import type { Support } from './types.ts';

const s = (independenceGroup: string, weight: Support['weight']): Support => ({ independenceGroup, weight });

// Spec §6.2, tabela de decisão — uma asserção por linha.

Deno.test('isConfirmed: uma fonte A basta', () => {
  assertEquals(isConfirmed([s('gutenberg.org', 'A')], false), true);
});

Deno.test('isConfirmed: dois grupos com pelo menos um B ou C confirmam', () => {
  assertEquals(isConfirmed([s('wikipedia.org', 'B'), s('blog.com', 'D')], false), true);
  assertEquals(isConfirmed([s('site-c.com', 'C'), s('blog.com', 'D')], false), true);
});

Deno.test('isConfirmed: dois grupos só D não confirmam; três grupos D confirmam', () => {
  assertEquals(isConfirmed([s('a.com', 'D'), s('b.com', 'D')], false), false);
  assertEquals(isConfirmed([s('a.com', 'D'), s('b.com', 'D'), s('c.com', 'D')], false), true);
});

Deno.test('isConfirmed: várias fontes do mesmo grupo contam como uma', () => {
  assertEquals(isConfirmed([s('wikipedia.org', 'B'), s('wikipedia.org', 'B')], false), false);
});

Deno.test('isConfirmed: um B sozinho não confirma', () => {
  assertEquals(isConfirmed([s('wikipedia.org', 'B')], false), false);
});

Deno.test('isConfirmed: interpretação exige dois grupos independentes, de qualquer peso', () => {
  assertEquals(isConfirmed([s('gutenberg.org', 'A')], true), false);
  assertEquals(isConfirmed([s('a.com', 'D'), s('b.com', 'D')], true), true);
});

Deno.test('bestWeightPerGroup: fica o melhor peso de cada grupo', () => {
  const best = bestWeightPerGroup([s('x.com', 'D'), s('x.com', 'B'), s('y.com', 'C')]);
  assertEquals(best.get('x.com'), 'B');
  assertEquals(best.get('y.com'), 'C');
});

Deno.test('resolveContradiction: lado com fonte A vence', () => {
  assertEquals(resolveContradiction([s('g.org', 'A')], [s('w.org', 'B'), s('c.com', 'C')]), 'a');
  assertEquals(resolveContradiction([s('w.org', 'B')], [s('g.org', 'A')]), 'b');
});

Deno.test('resolveContradiction: apoio comparável, nenhum entra', () => {
  assertEquals(resolveContradiction([s('w.org', 'B'), s('c.com', 'C')], [s('x.org', 'B'), s('y.com', 'C')]), 'neither');
});

Deno.test('resolveContradiction: apoio bem maior e confirmado vence', () => {
  const forte = [s('w.org', 'B'), s('c.com', 'C'), s('d.com', 'C')];
  const fraco = [s('blog.com', 'D')];
  assertEquals(resolveContradiction(forte, fraco), 'a');
});

Deno.test('resolveContradiction: apoio maior mas não confirmado não vence', () => {
  assertEquals(resolveContradiction([s('a.com', 'D'), s('b.com', 'D')], [s('c.com', 'D')]), 'neither');
});

Deno.test('factConfidence: 1 − Π(1 − w) por grupo, arredondado em 2 casas', () => {
  assertEquals(factConfidence([s('g.org', 'A')], false), 1);
  assertEquals(factConfidence([s('w.org', 'B'), s('c.com', 'C')], false), 0.85);
  assertEquals(factConfidence([s('w.org', 'B'), s('w.org', 'B')], false), 0.7);
});

Deno.test('factConfidence: contradição desconta 0,3 sem ficar negativo', () => {
  assertEquals(factConfidence([s('w.org', 'B'), s('c.com', 'C')], true), 0.55);
  assertEquals(factConfidence([s('a.com', 'D')], true), 0);
});

Deno.test('chapterStatus: limiar de fatos confirmados', () => {
  assertEquals(chapterStatus(0), 'insufficient');
  assertEquals(chapterStatus(1), 'partial');
  assertEquals(chapterStatus(MIN_FACTS_CONFIRMED - 1), 'partial');
  assertEquals(chapterStatus(MIN_FACTS_CONFIRMED), 'confirmed');
});

Deno.test('chapterConfidence: média das confianças; zero sem fato', () => {
  assertEquals(chapterConfidence([]), 0);
  assertEquals(chapterConfidence([1, 0.7, 0.85]), 0.85);
});
