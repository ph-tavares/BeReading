import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { chunkPart, partFromSource, partLabel } from './parts.ts';

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
