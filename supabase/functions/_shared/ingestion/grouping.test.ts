import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { batchClaims, buildGroupingPrompt, MAX_CLAIMS_PER_GROUPING, parseGrouping } from './grouping.ts';

const claims = [
  { id: 'c-a', statement: 'Bentinho encontra Capitu no muro.' },
  { id: 'c-b', statement: 'Bento vê Capitu riscando o muro.' },
  { id: 'c-c', statement: 'José Dias lê Walter Scott.' },
  { id: 'c-d', statement: 'José Dias nunca lê nada.' },
];

Deno.test('buildGroupingPrompt: numera as afirmações a partir de 1', () => {
  const prompt = buildGroupingPrompt('Capítulo 13', claims);
  assertStringIncludes(prompt, '[1] Bentinho encontra Capitu no muro.');
  assertStringIncludes(prompt, '[4] José Dias nunca lê nada.');
});

Deno.test('parseGrouping: grupos e contradições por índice de grupo', () => {
  const g = parseGrouping(JSON.stringify({ grupos: [[1, 2], [3], [4]], contradicoes: [[1, 2]] }), claims);
  assertEquals(g.groups, [['c-a', 'c-b'], ['c-c'], ['c-d']]);
  assertEquals(g.contradictions, [[1, 2]]);
});

Deno.test('parseGrouping: afirmação repetida fica no primeiro grupo; esquecida vira grupo próprio', () => {
  const g = parseGrouping(JSON.stringify({ grupos: [[1, 2], [2, 3]], contradicoes: [] }), claims);
  assertEquals(g.groups, [['c-a', 'c-b'], ['c-c'], ['c-d']]);
});

Deno.test('parseGrouping: índice inválido é ignorado; contradição com grupo inexistente ou consigo mesma cai', () => {
  const g = parseGrouping(JSON.stringify({ grupos: [[1, 99], [0, 3]], contradicoes: [[0, 7], [1, 1], [0, 1]] }), claims);
  assertEquals(g.groups, [['c-a'], ['c-c'], ['c-b'], ['c-d']]);
  assertEquals(g.contradictions, [[0, 1]]);
});

Deno.test('batchClaims: lotes do tamanho máximo', () => {
  const lotes = batchClaims(Array.from({ length: MAX_CLAIMS_PER_GROUPING + 1 }, (_, i) => i));
  assertEquals(lotes.map((l) => l.length), [MAX_CLAIMS_PER_GROUPING, 1]);
});
