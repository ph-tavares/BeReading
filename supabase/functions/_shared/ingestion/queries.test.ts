import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildBookQueries, buildChapterQuery } from './queries.ts';

const CORALINE = { title: 'Coraline', authors: ['Neil Gaiman'], publisher: 'Intrínseca', authorDeathYear: null, firstPublishYear: 2002 };
const DOM_CASMURRO = { title: 'Dom Casmurro', authors: ['Machado de Assis'], publisher: null, authorDeathYear: 1908, firstPublishYear: 1899 };

Deno.test('buildBookQueries: resumo por capítulo, sumário da editora e inglês; sem texto integral de obra protegida', () => {
  assertEquals(buildBookQueries(CORALINE, 2026), [
    '"Coraline" Neil Gaiman resumo por capítulo',
    '"Coraline" Neil Gaiman capítulos',
    '"Coraline" Neil Gaiman Intrínseca sumário',
    '"Coraline" Neil Gaiman chapter summary',
  ]);
});

Deno.test('buildBookQueries: obra em domínio público também procura o texto integral', () => {
  const queries = buildBookQueries(DOM_CASMURRO, 2026);
  assertEquals(queries.includes('"Dom Casmurro" Machado de Assis texto integral domínio público'), true);
  assertEquals(queries.some((q) => q.includes('sumário')), false);
});

Deno.test('buildChapterQuery: número e título do capítulo', () => {
  assertEquals(buildChapterQuery(DOM_CASMURRO, { number: 13, title: 'Capitu' }), '"Dom Casmurro" Machado de Assis capítulo 13 "Capitu" resumo');
  assertEquals(buildChapterQuery(CORALINE, { number: 4, title: null }), '"Coraline" Neil Gaiman capítulo 4 resumo');
});
