// supabase/functions/add-book/book.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { estimateChapters, findVisibleByIsbn, parseAddBookInput } from './book.ts';

const VALIDO = { title: 'O Hobbit', author: 'J. R. R. Tolkien', total_pages: 336, chapter_count: 19 };

Deno.test('parseAddBookInput: aceita o mínimo, sem ISBN nem capa', () => {
  const r = parseAddBookInput(VALIDO);
  assertEquals(r, {
    ok: true,
    input: { isbn: null, title: 'O Hobbit', author: 'J. R. R. Tolkien', totalPages: 336, chapterCount: 19, coverUrl: null },
  });
});

Deno.test('parseAddBookInput: normaliza ISBN com hífen e recusa ISBN malformado', () => {
  const ok = parseAddBookInput({ ...VALIDO, isbn: '978-85-9508-114-5' });
  assertEquals(ok.ok && ok.input.isbn, '9788595081145');
  assertEquals(parseAddBookInput({ ...VALIDO, isbn: '123' }), { ok: false, error: 'Invalid ISBN format' });
});

Deno.test('parseAddBookInput: recusa título e autor vazios, e colapsa espaços', () => {
  assertEquals(parseAddBookInput({ ...VALIDO, title: '   ' }), { ok: false, error: 'Invalid title' });
  assertEquals(parseAddBookInput({ ...VALIDO, author: '' }), { ok: false, error: 'Invalid author' });
  const r = parseAddBookInput({ ...VALIDO, title: '  O   Hobbit ' });
  assertEquals(r.ok && r.input.title, 'O Hobbit');
});

Deno.test('parseAddBookInput: páginas e capítulos inteiros, positivos e capítulos <= páginas', () => {
  assertEquals(parseAddBookInput({ ...VALIDO, total_pages: 0 }).ok, false);
  assertEquals(parseAddBookInput({ ...VALIDO, total_pages: 12.5 }).ok, false);
  assertEquals(parseAddBookInput({ ...VALIDO, total_pages: '336' }).ok, false);
  assertEquals(parseAddBookInput({ ...VALIDO, chapter_count: 0 }).ok, false);
  assertEquals(parseAddBookInput({ ...VALIDO, total_pages: 10, chapter_count: 11 }).ok, false);
});

Deno.test('parseAddBookInput: capa só da Open Library; outra URL vira nula', () => {
  const ol = parseAddBookInput({ ...VALIDO, cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg' });
  assertEquals(ol.ok && ol.input.coverUrl, 'https://covers.openlibrary.org/b/id/1-L.jpg');
  const outra = parseAddBookInput({ ...VALIDO, cover_url: 'https://exemplo.com/capa.jpg' });
  assertEquals(outra.ok && outra.input.coverUrl, null);
});

Deno.test('estimateChapters: cobre o livro inteiro, sem buraco nem sobreposição', () => {
  const caps = estimateChapters(10, 3);
  assertEquals(caps.map((c) => [c.start_page, c.end_page]), [[1, 3], [4, 6], [7, 10]]);
  assertEquals(caps.map((c) => c.title), ['Capítulo 1', 'Capítulo 2', 'Capítulo 3']);

  for (const [paginas, capitulos] of [[336, 19], [7, 7], [1, 1], [5000, 200]]) {
    const lista = estimateChapters(paginas, capitulos);
    assertEquals(lista.length, capitulos);
    assertEquals(lista[0].start_page, 1);
    assertEquals(lista[lista.length - 1].end_page, paginas);
    for (let i = 1; i < lista.length; i++) {
      assertEquals(lista[i].start_page, lista[i - 1].end_page + 1);
      assertEquals(lista[i].end_page >= lista[i].start_page, true);
    }
  }
});

Deno.test('findVisibleByIsbn: catálogo antes do próprio; livro de outro leitor não conta', () => {
  const catalogo = { id: 'c', added_by: null };
  const meu = { id: 'm', added_by: 'eu' };
  const alheio = { id: 'a', added_by: 'outro' };
  assertEquals(findVisibleByIsbn([meu, catalogo], 'eu'), catalogo);
  assertEquals(findVisibleByIsbn([alheio, meu], 'eu'), meu);
  assertEquals(findVisibleByIsbn([alheio], 'eu'), null);
});
