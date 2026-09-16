import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { compatible, confirmStructure, mergeDeclared, type StructureCandidate } from './structure.ts';
import type { DeclaredChapter } from './types.ts';

const ch = (number: number, title: string | null = null): DeclaredChapter => ({ number, part: null, numberInPart: null, title });
const tres = [ch(1, 'Do título'), ch(2, 'Do livro'), ch(3, 'A denúncia')];
const cand = (over: Partial<StructureCandidate>): StructureCandidate => ({
  sourceId: 's', independenceGroup: 'g', weight: 'D', tiedToIsbn: false, chapters: tres, ...over,
});

Deno.test('compatible: mesma contagem e títulos iguais onde os dois têm título', () => {
  assertEquals(compatible(tres, [ch(1), ch(2, 'Do Livro.'), ch(3)]), true);
  assertEquals(compatible(tres, [ch(1), ch(2)]), false);
  assertEquals(compatible(tres, [ch(1, 'Outro'), ch(2), ch(3)]), false);
});

Deno.test('mergeDeclared: completa títulos que faltam', () => {
  assertEquals(mergeDeclared([[ch(1), ch(2, 'Do livro')], [ch(1, 'Do título'), ch(2)]]), [ch(1, 'Do título'), ch(2, 'Do livro')]);
});

Deno.test('confirmStructure: uma fonte A confirma', () => {
  const r = confirmStructure([cand({ sourceId: 'gut', independenceGroup: 'gutenberg.org', weight: 'A' })]);
  assertEquals([r?.basis, r?.chapters.length, r?.confidence], ['primary', 3, 1]);
});

Deno.test('confirmStructure: dois grupos independentes concordando confirmam; um só não', () => {
  assertEquals(confirmStructure([cand({ sourceId: 'a', independenceGroup: 'a.com' })]), null);
  const r = confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com' }),
    cand({ sourceId: 'b', independenceGroup: 'b.com', chapters: [ch(1), ch(2), ch(3)] }),
  ]);
  assertEquals([r?.basis, r?.chapters[2].title], ['independent', 'A denúncia']);
});

Deno.test('confirmStructure: fonte ligada ao ISBN vence estrutura de outra edição', () => {
  const r = confirmStructure([
    cand({ sourceId: 'isbn', independenceGroup: 'editora.com.br', weight: 'B', tiedToIsbn: true, chapters: [ch(1), ch(2)] }),
    cand({ sourceId: 'a', independenceGroup: 'a.com', weight: 'A' }),
  ]);
  assertEquals([r?.basis, r?.chapters.length], ['isbn', 2]);
});

Deno.test('confirmStructure: fontes ligadas ao ISBN em conflito não confirmam', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'x', independenceGroup: 'x.com', tiedToIsbn: true, chapters: [ch(1), ch(2)] }),
    cand({ sourceId: 'y', independenceGroup: 'y.com', tiedToIsbn: true }),
  ]), null);
});

Deno.test('confirmStructure: duas estruturas confirmadas e incompatíveis não confirmam', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com', weight: 'A' }),
    cand({ sourceId: 'b', independenceGroup: 'b.com', weight: 'A', chapters: [ch(1), ch(2)] }),
  ]), null);
});

Deno.test('confirmStructure: lista com buraco na numeração é descartada', () => {
  assertEquals(confirmStructure([cand({ weight: 'A', chapters: [ch(1), ch(3)] })]), null);
});

Deno.test('confirmStructure: fonte sem títulos não une estruturas com títulos em conflito, em qualquer ordem', () => {
  const semTitulos = cand({ sourceId: 'n', independenceGroup: 'n.com', chapters: [ch(1), ch(2), ch(3)] });
  const a = cand({ sourceId: 'a', independenceGroup: 'a.com' });
  const b = cand({ sourceId: 'b', independenceGroup: 'b.com', chapters: [ch(1, 'Do título'), ch(2, 'Outro'), ch(3, 'A denúncia')] });
  assertEquals(confirmStructure([semTitulos, a, b]), null);
  assertEquals(confirmStructure([a, semTitulos, b]), null);
  assertEquals(confirmStructure([b, a, semTitulos]), null);
});
