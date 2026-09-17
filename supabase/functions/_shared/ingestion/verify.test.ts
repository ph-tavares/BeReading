import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { type ClaimForVerify, type SourceSupport, verifyChapter } from './verify.ts';

const src = (sourceId: string, independenceGroup: string, weight: SourceSupport['weight']): [string, SourceSupport] =>
  [sourceId, { sourceId, independenceGroup, weight }];

const SOURCES = new Map<string, SourceSupport>([
  src('gut', 'gutenberg.org', 'A'),
  src('wiki', 'wikipedia.org', 'B'),
  src('blog1', 'blog1.com', 'D'),
  src('blog2', 'blog2.com', 'D'),
]);

const claim = (id: string, sourceId: string, statement: string, over: Partial<ClaimForVerify> = {}): ClaimForVerify =>
  ({ id, sourceId, kind: 'event', statement, isInterpretation: false, ...over });

Deno.test('verifyChapter: grupo com fonte A vira fato com o enunciado da fonte A', () => {
  const r = verifyChapter(
    [claim('1', 'blog1', 'Bentinho vê Capitu no muro, riscando algo.'), claim('2', 'gut', 'Bentinho encontra Capitu riscando o muro.')],
    SOURCES,
    { groups: [['1', '2']], contradictions: [] },
  );
  assertEquals(r.facts.length, 1);
  assertEquals(r.facts[0].statement, 'Bentinho encontra Capitu riscando o muro.');
  assertEquals(r.facts[0].independentSupport, 2);
  assertEquals(r.facts[0].sourceIds, ['blog1', 'gut']);
  assertEquals(r.status, 'partial');
});

Deno.test('verifyChapter: grupo sem apoio suficiente não entra', () => {
  const r = verifyChapter([claim('1', 'blog1', 'Algo')], SOURCES, { groups: [['1']], contradictions: [] });
  assertEquals([r.facts.length, r.status, r.confidence, r.summary], [0, 'insufficient', 0, '']);
});

Deno.test('verifyChapter: contradição com lado A — A entra com desconto, o outro sai', () => {
  const r = verifyChapter(
    [claim('1', 'gut', 'Escobar sobrevive ao mar.'), claim('2', 'wiki', 'Escobar morre.'), claim('3', 'blog1', 'Escobar morre afogado.')],
    SOURCES,
    { groups: [['1'], ['2', '3']], contradictions: [[0, 1]] },
  );
  assertEquals(r.facts.map((f) => [f.statement, f.confidence]), [['Escobar sobrevive ao mar.', 0.7]]);
});

Deno.test('verifyChapter: contradição comparável — nenhum lado entra', () => {
  const r = verifyChapter(
    [
      claim('1', 'wiki', 'X'), claim('2', 'blog1', 'X'),
      claim('3', 'site-c', 'Não X'), claim('5', 'blog2', 'Não X'),
      claim('4', 'gut', 'Outro fato'),
    ],
    new Map([...SOURCES, src('site-c', 'site-c.com', 'C')]),
    // Apoio 1,0 (B + D) contra 0,8 (C + D): nenhum lado tem o dobro do outro.
    { groups: [['1', '2'], ['3', '5'], ['4']], contradictions: [[0, 1]] },
  );
  assertEquals(r.facts.map((f) => f.statement), ['Outro fato']);
});

Deno.test('verifyChapter: interpretação precisa de 2 grupos e fica fora do resumo e do status', () => {
  const r = verifyChapter(
    [
      claim('1', 'blog1', 'O ciúme conduz a narração.', { kind: 'theme', isInterpretation: true }),
      claim('2', 'blog2', 'A narração é guiada pelo ciúme.', { kind: 'theme', isInterpretation: true }),
    ],
    SOURCES,
    { groups: [['1', '2']], contradictions: [] },
  );
  assertEquals([r.facts.length, r.facts[0].isInterpretation, r.status, r.summary], [1, true, 'insufficient', '']);
});

Deno.test('verifyChapter: cinco fatos confirmados dão status confirmed e resumo só com fatos', () => {
  const claims = [1, 2, 3, 4, 5].map((n) => claim(String(n), 'gut', `Fato ${n}.`));
  const r = verifyChapter(claims, SOURCES, { groups: claims.map((c) => [c.id]), contradictions: [] });
  assertEquals(r.status, 'confirmed');
  assertEquals(r.summary, 'Fato 1. Fato 2. Fato 3. Fato 4. Fato 5.');
  assertEquals(r.confidence, 1);
});
