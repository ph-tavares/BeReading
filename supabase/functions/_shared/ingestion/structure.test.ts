import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { bestStructureGuess, compatible, confirmStructure, mergeDeclared, type StructureCandidate } from './structure.ts';
import type { DeclaredChapter } from './types.ts';

const ch = (number: number, title: string | null = null): DeclaredChapter => ({ number, part: null, numberInPart: null, title });
const tres = [ch(1, 'Do título'), ch(2, 'Do livro'), ch(3, 'A denúncia')];
const cand = (over: Partial<StructureCandidate>): StructureCandidate => ({
  sourceId: 's', independenceGroup: 'g', weight: 'D', tiedToIsbn: false, chapters: tres, complete: true, ...over,
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

Deno.test('confirmStructure: fonte A com 3 capítulos e fonte D com 2 não confirmam (edições em conflito, spec §6.3)', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'gut', independenceGroup: 'gutenberg.org', weight: 'A' }),
    cand({ sourceId: 'd', independenceGroup: 'd.com', chapters: [ch(1), ch(2)] }),
  ]), null);
});

Deno.test('confirmStructure: dois D concordando e um D incompatível não confirmam', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com' }),
    cand({ sourceId: 'b', independenceGroup: 'b.com' }),
    cand({ sourceId: 'c', independenceGroup: 'c.com', chapters: [ch(1, 'Do título'), ch(2, 'Outro'), ch(3, 'A denúncia')] }),
  ]), null);
});

// Spec §11, item 24: lista parcial apoia os capítulos que traz e só conta como grupo se chega ao fim.
const vinte4 = Array.from({ length: 24 }, (_, i) => ch(i + 1));

Deno.test('confirmStructure: lista completa e parcial que chega ao último capítulo, de grupos independentes, confirmam (caso 1984)', () => {
  const r = confirmStructure([
    cand({ sourceId: 'escola', independenceGroup: 'uol.com.br', chapters: vinte4 }),
    cand({ sourceId: 'resumo', independenceGroup: 'resumoporcapitulo.com.br', complete: false, chapters: vinte4.slice(2) }),
    cand({ sourceId: 'litcharts', independenceGroup: 'litcharts.com', complete: false, chapters: [ch(1, 'Chapter 1')] }),
  ]);
  assertEquals([r?.basis, r?.chapters.length, r?.chapters[0].title], ['independent', 24, null]);
});

Deno.test('confirmStructure: parcial que não chega ao fim não confirma a contagem sozinha', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com', chapters: vinte4 }),
    cand({ sourceId: 'b', independenceGroup: 'b.com', complete: false, chapters: vinte4.slice(0, 5) }),
  ]), null);
});

Deno.test('confirmStructure: parcial com número além do último ou título diferente é conflito', () => {
  const doisGrupos = [cand({ sourceId: 'a', independenceGroup: 'a.com' }), cand({ sourceId: 'b', independenceGroup: 'b.com' })];
  assertEquals(confirmStructure([...doisGrupos, cand({ sourceId: 'p', independenceGroup: 'p.com', complete: false, chapters: [ch(3), ch(4)] })]), null);
  assertEquals(confirmStructure([...doisGrupos, cand({ sourceId: 'q', independenceGroup: 'q.com', complete: false, chapters: [ch(2, 'Outro')] })]), null);
  assertEquals(confirmStructure([...doisGrupos, cand({ sourceId: 'r', independenceGroup: 'r.com', complete: false, chapters: [ch(2, 'Do livro')] })])?.chapters.length, 3);
});

Deno.test('confirmStructure: lista parcial nunca vira hipótese de estrutura, mesmo começando no 1', () => {
  assertEquals(confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com', complete: false }),
    cand({ sourceId: 'b', independenceGroup: 'b.com', complete: false }),
  ]), null);
});

Deno.test('bestStructureGuess: prefere a maior lista completa; sem nenhuma, a maior lista de números seguidos', () => {
  assertEquals(bestStructureGuess([
    cand({ complete: false, chapters: vinte4 }),
    cand({ chapters: [ch(1), ch(2)] }),
  ])?.length, 2);
  assertEquals(bestStructureGuess([cand({ complete: false, chapters: vinte4.slice(2) }), cand({ complete: false, chapters: vinte4 })])?.length, 24);
  assertEquals(bestStructureGuess([cand({ complete: false, chapters: [ch(2), ch(4)] })]), null);
});

// Run local do 1984, 21/09/2026 (BER-59): o PDF declarou os capítulos 2 a 8 e um post do Medium só
// o 1. Exigir começo no 1 elegia o Medium, e a segunda tentativa buscou 1 capítulo em vez de 8.
// O palpite só monta buscas (spec §11, item 25), então completar o começo não localiza fato.
Deno.test('bestStructureGuess: lista que começa depois do 1 vence a mais curta e ganha os capítulos que faltam no começo', () => {
  const guess = bestStructureGuess([
    cand({ complete: false, chapters: [ch(1)] }),
    cand({ complete: false, chapters: [ch(2, 'Dois'), ch(3), ch(4), ch(5), ch(6), ch(7), ch(8)] }),
  ]);
  assertEquals(guess?.map((c) => [c.number, c.title]), [[1, null], [2, 'Dois'], [3, null], [4, null], [5, null], [6, null], [7, null], [8, null]]);
});

// Caso do run de 1984 (BER-59): uma lista completa sem títulos (24), um índice parcial que começa
// no capítulo 3 e numera a parte por conta própria, e um texto integral (peso A) que só tinha parte
// do livro. Antes, o texto integral virava uma segunda estrutura completa e derrubava as duas.
Deno.test('confirmStructure: texto integral parcial e índice com numeração de parte própria não impedem a confirmação', () => {
  const comParte = (n: number, inPart: number) => ({ ...ch(n), numberInPart: inPart });
  const completa = Array.from({ length: 24 }, (_, i) => comParte(i + 1, i < 8 ? i + 1 : i < 18 ? i - 7 : i - 17));
  const indiceParcial = Array.from({ length: 22 }, (_, i) => comParte(i + 3, i < 6 ? i + 1 : i < 16 ? i - 5 : i - 15));
  const textoIntegral = Array.from({ length: 9 }, (_, i) => ch(i + 1, i < 2 ? 'Chapter ' + (i + 1) : null));

  const r = confirmStructure([
    cand({ sourceId: 'escola', independenceGroup: 'uol.com.br', chapters: completa }),
    cand({ sourceId: 'indice', independenceGroup: 'resumo.com.br', complete: false, chapters: indiceParcial }),
    cand({ sourceId: 'gut', independenceGroup: 'gutenberg.net.au', weight: 'A', complete: false, chapters: textoIntegral }),
  ]);

  assertEquals([r?.basis, r?.chapters.length], ['independent', 24]);
});

Deno.test('confirmStructure: lista completa refutada por capítulo descrito em lista parcial sai da disputa', () => {
  const vinte4b = Array.from({ length: 24 }, (_, i) => ch(i + 1));
  const r = confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com', chapters: vinte4b }),
    // Diz que o livro tem 23 capítulos, mas outra fonte descreve o 24: lista lida pela metade.
    cand({ sourceId: 'b', independenceGroup: 'b.com', chapters: vinte4b.slice(0, 23) }),
    cand({ sourceId: 'c', independenceGroup: 'c.com', complete: false, chapters: vinte4b.slice(2) }),
  ]);
  assertEquals(r?.chapters.length, 24);

  // Sem a parcial que alcança o 24, as duas listas completas continuam sendo conflito de edição.
  assertEquals(confirmStructure([
    cand({ sourceId: 'a', independenceGroup: 'a.com', chapters: vinte4b }),
    cand({ sourceId: 'b', independenceGroup: 'b.com', chapters: vinte4b.slice(0, 23) }),
  ]), null);
});

// Defeito 5 (BER-59, run local de 21/09/2026): o texto integral do 1984 lido em blocos declara
// "Chapter 1" em cada parte. As partes têm 8, 10 e 6 capítulos.
const PARTES_1984 = [8, 10, 6];
const blocoDaParte = (parte: number, n: number): DeclaredChapter => ({ number: n, part: `Parte ${parte}`, numberInPart: n, title: null });
const textoIntegral1984 = (): DeclaredChapter[][] =>
  PARTES_1984.map((qtd, i) => Array.from({ length: qtd }, (_, k) => blocoDaParte(i + 1, k + 1)));

Deno.test('mergeDeclaredKeepingParts: o capítulo 1 de cada parte não vira um só', async () => {
  const { mergeDeclaredKeepingParts } = await import('./structure.ts');
  assertEquals(mergeDeclaredKeepingParts(textoIntegral1984()).length, 24);
  // Sem parte, continua juntando pelo número, e completa o título.
  assertEquals(mergeDeclaredKeepingParts([[ch(1)], [ch(1, 'A')]]), [ch(1, 'A')]);
});

Deno.test('wholeBookNumbering: converte parte + número na parte para a numeração do livro inteiro', async () => {
  const { mergeDeclaredKeepingParts, wholeBookNumbering } = await import('./structure.ts');
  const lista = wholeBookNumbering(mergeDeclaredKeepingParts(textoIntegral1984()))!;
  assertEquals(lista.map((c) => c.number), Array.from({ length: 24 }, (_, i) => i + 1));
  assertEquals([lista[8].part, lista[8].numberInPart], ['Parte 2', 1]);
  assertEquals([lista[18].part, lista[18].numberInPart], ['Parte 3', 1]);
});

Deno.test('wholeBookNumbering: na dúvida não converte (parte ou capítulo faltando)', async () => {
  const { wholeBookNumbering } = await import('./structure.ts');
  // Só a Parte 2: não dá para saber quantos capítulos vêm antes.
  assertEquals(wholeBookNumbering([blocoDaParte(2, 1), blocoDaParte(2, 2)]), null);
  // Parte 1 com buraco no capítulo 3.
  assertEquals(wholeBookNumbering([blocoDaParte(1, 1), blocoDaParte(1, 2), blocoDaParte(1, 4)]), null);
  // Sem parte nenhuma, é a lista de sempre.
  assertEquals(wholeBookNumbering([ch(2), ch(1)]), [ch(1), ch(2)]);
});

Deno.test('confirmStructure: o texto integral em blocos passa a ser a segunda voz dos 24 capítulos do 1984', async () => {
  const { mergeDeclaredKeepingParts, wholeBookNumbering } = await import('./structure.ts');
  const guia = Array.from({ length: 24 }, (_, i) => ch(i + 1));
  const integral = wholeBookNumbering(mergeDeclaredKeepingParts(textoIntegral1984()))!;
  const r = confirmStructure([
    cand({ sourceId: 'historyhit', independenceGroup: 'historyhit.com', weight: 'D', chapters: guia, complete: true }),
    cand({ sourceId: 'archive', independenceGroup: 'obra', weight: 'A', chapters: integral, complete: false }),
  ]);
  assertEquals([r?.basis, r?.chapters.length], ['primary', 24]);
  assertEquals([r?.chapters[8].part, r?.chapters[8].numberInPart], ['Parte 2', 1]);
});

Deno.test('chaptersFromClaims: capítulos citados pelo texto integral completam a lista, sem antecipação nem capítulo sem parte', async () => {
  const { chaptersFromClaims, mergeDeclaredKeepingParts, wholeBookNumbering } = await import('./structure.ts');
  const ref = (part: string | null, numberInPart: number | null) => ({ number: null, part, numberInPart });
  const claims = [
    { chapterRef: ref('Parte 1', 7), forwardReference: false },
    { chapterRef: ref('Parte 2', 1), forwardReference: false },
    { chapterRef: ref('Parte 3', 6), forwardReference: true },
    { chapterRef: ref(null, 4), forwardReference: false },
  ];
  assertEquals(chaptersFromClaims(claims).map((c) => [c.part, c.numberInPart]), [['Parte 1', 7], ['Parte 2', 1]]);

  // Lista declarada sem o 7 da Parte 1; as afirmações trazem o 7 e fecham a parte.
  const declarada = [1, 2, 3, 4, 5, 6, 8].map((n) => blocoDaParte(1, n));
  assertEquals(wholeBookNumbering(declarada), null);
  assertEquals(wholeBookNumbering(mergeDeclaredKeepingParts([declarada, chaptersFromClaims(claims)]))?.length, 9);
});
