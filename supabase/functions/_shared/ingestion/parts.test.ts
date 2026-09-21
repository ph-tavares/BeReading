import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { chunkPart, declaredWithParts, nextMaxChapter, partForNextChunk, partFromSource, partLabel, partStillValid } from './parts.ts';
import type { DeclaredChapter } from './types.ts';

Deno.test('partLabel: reconhece as formas que as fontes usam', () => {
  assertEquals(partLabel('PARTE 2'), 'Parte 2');
  assertEquals(partLabel('Segunda Parte'), 'Parte 2');
  assertEquals(partLabel('PART TWO'), 'Parte 2');
  assertEquals(partLabel('Book III'), 'Parte 3');
  assertEquals(partLabel('Livro 3'), 'Parte 3');
  assertEquals(partLabel('Capítulo 2'), null, 'capítulo não é parte');
  assertEquals(partLabel('A parte final da história'), null, 'só vale como cabeçalho, no começo da linha');
  assertEquals(partLabel(null), null);
});

Deno.test('partFromSource: parte vinda da URL ou do título da página', () => {
  assertEquals(partFromSource('https://www.litcharts.com/lit/1984/book-2-chapter-1', null), 'Parte 2');
  assertEquals(partFromSource('https://ex.com/1984/parte-3/capitulo-5', null), 'Parte 3');
  assertEquals(partFromSource('https://ex.com/1984/resumo', 'Part 3, Chapter 1 | Guia'), 'Parte 3');
  assertEquals(partFromSource('https://ex.com/1984/resumo-completo', 'Resumo de 1984'), null);
});

Deno.test('chunkPart: bloco sem cabeçalho continua na parte anterior', () => {
  const r = chunkPart('Winston caminha pelo corredor.\nA teletela observa.', 'Parte 1');
  assertEquals([r.start, r.end, r.changes], ['Parte 1', 'Parte 1', false]);
});

Deno.test('chunkPart: cabeçalho no começo do bloco vale para o bloco inteiro', () => {
  const r = chunkPart('SEGUNDA PARTE\n\nEra meio da manhã quando Winston deixou o cubículo.', 'Parte 1');
  assertEquals([r.start, r.end, r.changes], ['Parte 2', 'Parte 2', false]);
});

Deno.test('chunkPart: bloco que troca de parte no meio não atribui parte a ninguém', () => {
  const texto = ['Fim do último capítulo da primeira parte.', '', 'PARTE 2', '', 'Começo da segunda parte.'].join('\n');
  const r = chunkPart(texto, 'Parte 1');
  assertEquals([r.start, r.end, r.changes], ['Parte 1', 'Parte 2', true]);
});

// Sétimo teste do 1984 (BER-59): um PDF longo do archive.org teve "Parte 1" reconhecida no começo
// do arquivo e carregada por 30 blocos; os blocos finais, que falavam de Julia e da Sala 101,
// entraram como Parte 1, capítulo 1.
Deno.test('partStillValid: numeração que recua invalida a parte herdada', () => {
  assertEquals(partStillValid(8, 1), false, 'saiu do capítulo 8 e voltou ao 1: mudou de parte');
  assertEquals(partStillValid(3, 4), true);
  assertEquals(partStillValid(3, 3), true, 'o mesmo capítulo continua no bloco seguinte');
  assertEquals(partStillValid(null, 2), true, 'primeiro bloco da fonte');
  assertEquals(partStillValid(5, null), true, 'bloco sem capítulo não diz nada');
});

// Defeito 5 (BER-59, run local de 21/09/2026): no texto do 1984 do Gutenberg AU o título do livro
// vem antes de "PART ONE", então o cabeçalho cai no meio do primeiro bloco e nenhum bloco ganhava parte.
const cap = (number: number): DeclaredChapter => ({ number, part: null, numberInPart: null, title: null });

Deno.test('partForNextChunk: bloco com cabeçalho passa a parte do cabeçalho, mesmo sem parte própria', () => {
  const primeiro = chunkPart(['1984', 'George Orwell', '', 'PART ONE', '', 'Chapter 1', 'It was a bright cold day.'].join('\n'), null);
  assertEquals([primeiro.start, primeiro.changes, primeiro.headings], [null, true, 1]);
  assertEquals(partForNextChunk(primeiro, null), 'Parte 1');
  // Sem cabeçalho, continua como era: parte invalidada não passa adiante.
  assertEquals(partForNextChunk(chunkPart('texto corrido', 'Parte 1'), null), null);
  assertEquals(partForNextChunk(chunkPart('texto corrido', 'Parte 1'), 'Parte 1'), 'Parte 1');
});

Deno.test('declaredWithParts: separa pela volta da numeração num bloco que troca de parte', () => {
  const troca = chunkPart(['fim do capítulo 8', '', 'PART TWO', '', 'Chapter 1'].join('\n'), 'Parte 1');
  const r = declaredWithParts([cap(8), cap(1)], troca, null);
  assertEquals(r.map((c) => [c.part, c.numberInPart]), [['Parte 1', 8], ['Parte 2', 1]]);
});

Deno.test('declaredWithParts: sem parte anterior conhecida, é a do cabeçalho; dois cabeçalhos no bloco, não marca', () => {
  const primeiro = chunkPart(['1984', '', 'PART ONE', '', 'Chapter 1'].join('\n'), null);
  assertEquals(declaredWithParts([cap(1)], primeiro, null).map((c) => c.part), ['Parte 1']);
  const dois = chunkPart(['x', 'PART ONE', 'y', 'PART TWO', 'z'].join('\n'), null);
  assertEquals(declaredWithParts([cap(1), cap(1)], dois, null).map((c) => c.part), [null, null]);
  // Bloco sem troca: a parte do bloco, se houver.
  assertEquals(declaredWithParts([cap(3)], chunkPart('texto', 'Parte 1'), 'Parte 1').map((c) => c.part), ['Parte 1']);
});

Deno.test('nextMaxChapter: parte nova recomeça a contagem', () => {
  assertEquals(nextMaxChapter(chunkPart('texto', 'Parte 1'), 7, [8]), 8);
  assertEquals(nextMaxChapter(chunkPart('PART TWO\n\nChapter 1', 'Parte 1'), 8, [1]), 1, 'cabeçalho no topo: só os deste bloco');
  assertEquals(nextMaxChapter(chunkPart('fim\nPART TWO\nChapter 1', 'Parte 1'), 8, [8, 1]), null, 'troca no meio: não se sabe');
});
