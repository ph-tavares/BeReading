// supabase/functions/_shared/chapter-web-content.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildChapterWebQuery, WEB_CONTENT_MAX_CHARS, webContentFromSearch } from './chapter-web-content.ts';

const longo = (s: string) => s.repeat(30);

Deno.test('buildChapterWebQuery: usa o título do capítulo quando diz algo; "Capítulo N" vira o número', () => {
  const livro = { title: '1984', author: 'George Orwell' };
  assertEquals(buildChapterWebQuery(livro, { number: 9, title: 'Parte 2 - Capítulo 1' }), '"1984" George Orwell Parte 2 - Capítulo 1 resumo');
  assertEquals(buildChapterWebQuery(livro, { number: 3, title: 'Capítulo 3' }), '"1984" George Orwell capítulo 3 resumo');
  assertEquals(buildChapterWebQuery(livro, { number: 3, title: null }), '"1984" George Orwell capítulo 3 resumo');
});

Deno.test('webContentFromSearch: junta resposta e trechos, sem repetir, com os domínios', () => {
  const r = webContentFromSearch({
    answer: longo('Resumo. '),
    results: [
      { url: 'https://www.a.com/x', content: 'Trecho A' },
      { url: 'https://b.org/y', content: 'Trecho A' },
      { url: 'https://c.net/z', content: 'Trecho C' },
      { url: 'nao-e-url', content: '' },
    ],
  })!;
  assertEquals(r.text.includes('Trecho A') && r.text.includes('Trecho C'), true);
  assertEquals(r.text.split('Trecho A').length - 1, 1);
  assertEquals(r.domains, ['a.com', 'c.net']);
});

Deno.test('webContentFromSearch: pouco texto não serve; texto demais é cortado', () => {
  assertEquals(webContentFromSearch({ results: [{ url: 'https://a.com', content: 'curto' }] }), null);
  assertEquals(webContentFromSearch(null), null);
  const r = webContentFromSearch({ results: [{ url: 'https://a.com', content: 'x'.repeat(10_000) }] })!;
  assertEquals(r.text.length, WEB_CONTENT_MAX_CHARS);
});
