import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { HttpStatusError } from '../queue.ts';
import {
  fetchOpenLibraryEdition,
  languageFromKey,
  originalLanguageFromEditions,
  parseTableOfContents,
  parseYear,
} from './openlibrary-edition.ts';

function fakeFetch(routes: Record<string, unknown>, status: Record<string, number> = {}): typeof fetch {
  return ((input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (status[url]) return Promise.resolve(new Response('x', { status: status[url] }));
    if (!(url in routes)) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(Response.json(routes[url]));
  }) as typeof fetch;
}

Deno.test('languageFromKey e parseYear', () => {
  assertEquals(languageFromKey('/languages/por'), 'pt');
  assertEquals(languageFromKey('/languages/eng'), 'en');
  assertEquals(languageFromKey(undefined), null);
  assertEquals(parseYear('June 8, 1949'), 1949);
  assertEquals(parseYear('1899'), 1899);
  assertEquals(parseYear('sem data'), null);
});

Deno.test('parseTableOfContents: cabeçalho de parte reinicia a numeração na parte', () => {
  const toc = parseTableOfContents([
    { level: 0, title: 'Part One' },
    { level: 1, label: '1', title: 'Chapter 1' },
    { level: 1, label: '2', title: 'Chapter 2' },
    { level: 0, title: 'Part Two' },
    { level: 1, label: '1', title: 'Chapter 1' },
  ]);
  assertEquals(toc, [
    { number: 1, part: 'Part One', numberInPart: 1, title: 'Chapter 1' },
    { number: 2, part: 'Part One', numberInPart: 2, title: 'Chapter 2' },
    { number: 3, part: 'Part Two', numberInPart: 1, title: 'Chapter 1' },
  ]);
  assertEquals(parseTableOfContents(['Do título', 'Do livro']), [
    { number: 1, part: null, numberInPart: null, title: 'Do título' },
    { number: 2, part: null, numberInPart: null, title: 'Do livro' },
  ]);
  assertEquals(parseTableOfContents(undefined), []);
});

Deno.test('parseTableOfContents: capítulo de apoio (prefácio, notas etc.) não desloca a numeração (BER-59 I8)', () => {
  assertEquals(parseTableOfContents(['Prefácio', 'Capítulo 1', 'Capítulo 2', 'Notas']), [
    { number: 1, part: null, numberInPart: null, title: 'Capítulo 1' },
    { number: 2, part: null, numberInPart: null, title: 'Capítulo 2' },
  ]);
});

Deno.test('parseTableOfContents: parte por nível, sem "Parte" no título (BER-59 I8)', () => {
  const toc = parseTableOfContents([
    { level: 0, title: 'Genesis' },
    { level: 1, title: 'In the Beginning' },
    { level: 1, title: 'Noah' },
    { level: 0, title: 'Exodus' },
    { level: 1, title: 'Out of Egypt' },
  ]);
  assertEquals(toc, [
    { number: 1, part: 'Genesis', numberInPart: 1, title: 'In the Beginning' },
    { number: 2, part: 'Genesis', numberInPart: 2, title: 'Noah' },
    { number: 3, part: 'Exodus', numberInPart: 1, title: 'Out of Egypt' },
  ]);
});

Deno.test('parseTableOfContents: capítulo solto no topo, seções e três níveis não somem nem deslocam a numeração (BER-59 I8)', () => {
  assertEquals(parseTableOfContents([
    { level: 0, title: 'Prólogo' },
    { level: 0, title: 'Parte 1' },
    { level: 1, title: 'Cap 1' },
    { level: 1, title: 'Cap 2' },
    { level: 0, title: 'Epílogo' },
  ]), [
    { number: 1, part: null, numberInPart: null, title: 'Prólogo' },
    { number: 2, part: 'Parte 1', numberInPart: 1, title: 'Cap 1' },
    { number: 3, part: 'Parte 1', numberInPart: 2, title: 'Cap 2' },
    { number: 4, part: null, numberInPart: null, title: 'Epílogo' },
  ]);
  assertEquals(parseTableOfContents([
    { level: 0, title: 'Capítulo 1' },
    { level: 1, title: '1.1' },
    { level: 1, title: '1.2' },
    { level: 0, title: 'Capítulo 2' },
  ]), [
    { number: 1, part: null, numberInPart: null, title: 'Capítulo 1' },
    { number: 2, part: null, numberInPart: null, title: 'Capítulo 2' },
  ]);
  assertEquals(parseTableOfContents([
    { level: 0, title: 'Parte 1' },
    { level: 1, title: 'Cap 1' },
    { level: 2, title: 'Seção a' },
    { level: 1, title: 'Cap 2' },
  ]), [
    { number: 1, part: 'Parte 1', numberInPart: 1, title: 'Cap 1' },
    { number: 2, part: 'Parte 1', numberInPart: 2, title: 'Cap 2' },
  ]);
  // Níveis relativos: sumário que começa no nível 1 é lido como se começasse no 0.
  assertEquals(parseTableOfContents([{ level: 1, title: 'Parte A' }, { level: 2, title: 'Um' }, { level: 2, title: 'Dois' }]), [
    { number: 1, part: 'Parte A', numberInPart: 1, title: 'Um' },
    { number: 2, part: 'Parte A', numberInPart: 2, title: 'Dois' },
  ]);
});

Deno.test('originalLanguageFromEditions: idioma da edição mais antiga', () => {
  assertEquals(originalLanguageFromEditions([
    { publish_date: '2009', languages: [{ key: '/languages/por' }] },
    { publish_date: '1949', languages: [{ key: '/languages/eng' }] },
    { publish_date: '1950' },
  ]), 'en');
  assertEquals(originalLanguageFromEditions([]), null);
});

Deno.test('fetchOpenLibraryEdition: junta edição, autor e obra', async () => {
  const fetchFn = fakeFetch({
    'https://openlibrary.org/isbn/9780000000001.json': {
      title: 'Livro Sintético', publishers: ['Editora Exemplo'], publish_date: '2010', languages: [{ key: '/languages/por' }],
      authors: [{ key: '/authors/OL1A' }], works: [{ key: '/works/OL1W' }], table_of_contents: ['Um', 'Dois'],
    },
    'https://openlibrary.org/authors/OL1A.json': { name: 'Autora Exemplo', death_date: '1930' },
    'https://openlibrary.org/works/OL1W.json': { first_publish_date: '1890' },
    'https://openlibrary.org/works/OL1W/editions.json?limit=100': {
      entries: [{ publish_date: '1890', languages: [{ key: '/languages/fre' }] }],
    },
  });
  const edition = await fetchOpenLibraryEdition('9780000000001', fetchFn);
  assertEquals(edition, {
    title: 'Livro Sintético', authors: ['Autora Exemplo'], authorDeathYear: 1930, publishers: ['Editora Exemplo'], language: 'pt',
    publishYear: 2010, firstPublishYear: 1890, workKey: '/works/OL1W', originalLanguage: 'fr',
    tableOfContents: [
      { number: 1, part: null, numberInPart: null, title: 'Um' },
      { number: 2, part: null, numberInPart: null, title: 'Dois' },
    ],
  });
});

Deno.test('fetchOpenLibraryEdition: edição sem autores usa o autor e a data da obra (BER-59)', async () => {
  const fetchFn = fakeFetch({
    'https://openlibrary.org/isbn/9780000000004.json': {
      title: 'Livro Traduzido', publishers: ['Editora Exemplo'], publish_date: '2009', languages: [{ key: '/languages/por' }],
      contributors: [{ role: 'Translator', name: 'Tradutora Exemplo' }], works: [{ key: '/works/OL2W' }],
    },
    'https://openlibrary.org/works/OL2W.json': { authors: [{ author: { key: '/authors/OL2A' }, type: { key: '/type/author_role' } }] },
    'https://openlibrary.org/authors/OL2A.json': { name: 'Autor Exemplo', death_date: '21 January 1950' },
    'https://openlibrary.org/works/OL2W/editions.json?limit=100': {
      entries: [
        { publish_date: '2009', languages: [{ key: '/languages/por' }] },
        { publish_date: 'June 8, 1949', languages: [{ key: '/languages/eng' }] },
        { publish_date: 'sem data' },
      ],
    },
  });
  const edition = await fetchOpenLibraryEdition('9780000000004', fetchFn);
  assertEquals(
    [edition?.authors, edition?.authorDeathYear, edition?.firstPublishYear, edition?.originalLanguage],
    [['Autor Exemplo'], 1950, 1949, 'en'],
  );
});

Deno.test('fetchOpenLibraryEdition: ISBN inexistente devolve null; 503 lança transitório', async () => {
  assertEquals(await fetchOpenLibraryEdition('9780000000002', fakeFetch({})), null);
  await assertRejects(
    () => fetchOpenLibraryEdition('9780000000003', fakeFetch({}, { 'https://openlibrary.org/isbn/9780000000003.json': 503 })),
    HttpStatusError,
  );
});
