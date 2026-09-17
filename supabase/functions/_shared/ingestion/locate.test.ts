import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { locateChapter, looksForwardReferencing, normalizePart, normalizeTitle } from './locate.ts';
import type { ChapterRef, EditionChapter } from './types.ts';

const ref = (over: Partial<ChapterRef>): ChapterRef => ({ number: null, part: null, numberInPart: null, title: null, ...over });

// Estrutura sintética com partes, como a de 1984: Parte 1 com 2 capítulos, Parte 2 com 2.
const COM_PARTES: EditionChapter[] = [
  { id: 'c1', number: 1, partLabel: 'Parte 1', numberInPart: 1, title: null },
  { id: 'c2', number: 2, partLabel: 'Parte 1', numberInPart: 2, title: null },
  { id: 'c3', number: 3, partLabel: 'Parte 2', numberInPart: 1, title: null },
  { id: 'c4', number: 4, partLabel: 'Parte 2', numberInPart: 2, title: null },
];

// Estrutura sem partes, com títulos, como a de Dom Casmurro.
const COM_TITULOS: EditionChapter[] = [
  { id: 'd1', number: 1, partLabel: null, numberInPart: null, title: 'Do título' },
  { id: 'd2', number: 2, partLabel: null, numberInPart: null, title: 'Do livro' },
  { id: 'd3', number: 3, partLabel: null, numberInPart: null, title: 'A denúncia' },
];

Deno.test('normalizeTitle: tira prefixo de capítulo, acento, caixa e pontuação', () => {
  assertEquals(normalizeTitle('CAPÍTULO III — A Denúncia.'), 'a denuncia');
  assertEquals(normalizeTitle('Chapter 2: Do livro'), 'do livro');
  assertEquals(normalizeTitle(null), '');
});

Deno.test('normalizePart: número, romano e ordinal por extenso viram o mesmo número', () => {
  assertEquals(normalizePart('Parte 2'), '2');
  assertEquals(normalizePart('PART II'), '2');
  assertEquals(normalizePart('Segunda parte'), '2');
  assertEquals(normalizePart('Part Three'), '3');
});

Deno.test('locateChapter: parte + número na parte', () => {
  assertEquals(locateChapter(ref({ part: 'Part Two', numberInPart: 1 }), COM_PARTES)?.id, 'c3');
});

Deno.test('locateChapter: número sem parte num livro com partes é ambíguo', () => {
  assertEquals(locateChapter(ref({ number: 2 }), COM_PARTES), null);
});

Deno.test('locateChapter: número sequencial num livro sem partes', () => {
  assertEquals(locateChapter(ref({ number: 3 }), COM_TITULOS)?.id, 'd3');
});

Deno.test('locateChapter: título resolve numeração de outra edição; número e título em conflito é ambíguo', () => {
  assertEquals(locateChapter(ref({ title: 'Capítulo II - Do Livro' }), COM_TITULOS)?.id, 'd2');
  assertEquals(locateChapter(ref({ number: 1, title: 'A denúncia' }), COM_TITULOS), null);
});

Deno.test('locateChapter: sem referência ou sem correspondência devolve null', () => {
  assertEquals(locateChapter(null, COM_TITULOS), null);
  assertEquals(locateChapter(ref({ number: 99 }), COM_TITULOS), null);
});

Deno.test('looksForwardReferencing: frase que antecipa capítulo posterior', () => {
  assertEquals(looksForwardReferencing('Capitu, que mais tarde se casa com Bento, aparece no muro.'), true);
  assertEquals(looksForwardReferencing('Isso será revelado no fim do livro.'), true);
  assertEquals(looksForwardReferencing('He will later discover the truth.'), true);
  assertEquals(looksForwardReferencing('Bentinho vai ao quintal e encontra Capitu riscando o muro.'), false);
});

Deno.test('looksForwardReferencing: outras construções que antecipam o futuro', () => {
  for (const s of [
    'Anos depois, ele reencontra o amigo.',
    'Ela viria a ser sua esposa.',
    'O rapaz acabaria por deixar o seminário.',
    'Ele estava destinado a partir.',
    'He eventually leaves the town.',
    'It turns out she was right.',
    'She was destined to rule.',
    'She goes on to marry him.',
  ]) {
    assertEquals(looksForwardReferencing(s), true, s);
  }
});

Deno.test('normalizePart: palavra com nome de chave do protótipo não devolve função', () => {
  assertEquals(typeof normalizePart('Parte constructor'), 'string');
});
