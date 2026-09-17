import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { fetchGoogleBooks } from './googlebooks.ts';

Deno.test('fetchGoogleBooks: primeiro volume', async () => {
  const fetchFn = ((input: RequestInfo | URL) => {
    assertEquals(String(input), 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780000000001');
    return Promise.resolve(Response.json({
      items: [{ volumeInfo: { title: 'Livro Sintético', authors: ['Autora Exemplo'], publisher: 'Editora Exemplo', language: 'pt-BR', publishedDate: '2010-05-01' } }],
    }));
  }) as typeof fetch;
  assertEquals(await fetchGoogleBooks('9780000000001', fetchFn), {
    title: 'Livro Sintético', authors: ['Autora Exemplo'], publisher: 'Editora Exemplo', language: 'pt', publishYear: 2010,
  });
});

Deno.test('fetchGoogleBooks: sem itens devolve null', async () => {
  const fetchFn = (() => Promise.resolve(Response.json({ totalItems: 0 }))) as typeof fetch;
  assertEquals(await fetchGoogleBooks('9780000000001', fetchFn), null);
});
