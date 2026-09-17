// supabase/functions/_shared/openlibrary.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildCoverUrl,
  isValidIsbnFormat,
  normalizeIsbn,
  parseOpenLibraryEdition,
  parsePaginationString,
} from './openlibrary.ts';

Deno.test('normalizeIsbn: remove hífens', () => {
  assertEquals(normalizeIsbn('978-0-451-52493-5'), '9780451524935');
});

Deno.test('normalizeIsbn: remove espaços e deixa X maiúsculo (ISBN-10)', () => {
  assertEquals(normalizeIsbn('0 451 52493 x'), '045152493X');
});

Deno.test('isValidIsbnFormat: aceita ISBN-13 de 13 dígitos', () => {
  assertEquals(isValidIsbnFormat('9780451524935'), true);
});

Deno.test('isValidIsbnFormat: aceita ISBN-10 terminado em X', () => {
  assertEquals(isValidIsbnFormat('045152493X'), true);
});

Deno.test('isValidIsbnFormat: rejeita tamanho errado', () => {
  assertEquals(isValidIsbnFormat('12345'), false);
});

Deno.test('isValidIsbnFormat: rejeita letras fora da posição de checksum', () => {
  assertEquals(isValidIsbnFormat('97804515249XY'), false);
});

Deno.test('parsePaginationString: extrai o número de "328p."', () => {
  assertEquals(parsePaginationString('328p.'), 328);
});

Deno.test('parsePaginationString: null quando não há dígito', () => {
  assertEquals(parsePaginationString('sem páginas'), null);
});

Deno.test('parsePaginationString: null quando undefined', () => {
  assertEquals(parsePaginationString(undefined), null);
});

Deno.test('buildCoverUrl: monta a URL a partir do id', () => {
  assertEquals(
    buildCoverUrl(12054527),
    'https://covers.openlibrary.org/b/id/12054527-L.jpg',
  );
});

Deno.test('buildCoverUrl: null sem id', () => {
  assertEquals(buildCoverUrl(undefined), null);
});

// ---------------------------------------------------------------------------
// parseOpenLibraryEdition — fixture real (GET /isbn/9780451524935.json, 1984)
// ---------------------------------------------------------------------------

const FIXTURE_1984 = {
  title: 'Nineteen Eighty-Four',
  publish_date: '1993?',
  publishers: ['Signet Classics'],
  covers: [12054527],
  isbn_13: ['9780451524935'],
  pagination: '328p.',
  author: ['Orwell, George, 1903-1950.'],
  number_of_pages: 328,
};

Deno.test('parseOpenLibraryEdition: extrai título, editora, ano e páginas', () => {
  const result = parseOpenLibraryEdition(FIXTURE_1984);
  assertEquals(result.title, 'Nineteen Eighty-Four');
  assertEquals(result.publisher, 'Signet Classics');
  assertEquals(result.publishYear, '1993?');
  assertEquals(result.totalPages, 328);
  assertEquals(result.authors, ['Orwell, George, 1903-1950.']);
  assertEquals(result.coverUrl, 'https://covers.openlibrary.org/b/id/12054527-L.jpg');
});

Deno.test('parseOpenLibraryEdition: usa pagination quando number_of_pages falta', () => {
  const { number_of_pages, ...semNumeroDePaginas } = FIXTURE_1984;
  const result = parseOpenLibraryEdition(semNumeroDePaginas);
  assertEquals(result.totalPages, 328);
});

Deno.test('parseOpenLibraryEdition: honesto sobre autor quando só há authors por key (não resolvido)', () => {
  const semAuthorDireto = {
    title: 'Some Book',
    authors: [{ key: '/authors/OL12345A' }],
  };
  const result = parseOpenLibraryEdition(semAuthorDireto);
  assertEquals(result.authors, []);
});

Deno.test('parseOpenLibraryEdition: campos ausentes viram null/vazio, não erro', () => {
  const result = parseOpenLibraryEdition({});
  assertEquals(result.title, '');
  assertEquals(result.authors, []);
  assertEquals(result.publisher, null);
  assertEquals(result.publishYear, null);
  assertEquals(result.totalPages, null);
  assertEquals(result.coverUrl, null);
});
