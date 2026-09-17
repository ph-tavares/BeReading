import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { HttpStatusError } from '../queue.ts';
import { normalizeResultUrl, tavilySearch } from './tavily.ts';

Deno.test('normalizeResultUrl: tira fragmento e parâmetros de rastreio; recusa esquema estranho', () => {
  assertEquals(normalizeResultUrl('https://ex.com/resumo?utm_source=x&id=3#topo'), 'https://ex.com/resumo?id=3');
  assertEquals(normalizeResultUrl('javascript:alert(1)'), null);
});

Deno.test('tavilySearch: envia busca básica autenticada e normaliza resultados', async () => {
  // Objeto mutado dentro do callback: com `let sent = null` o TypeScript estreitaria para `never`.
  const sent = { headers: new Headers(), body: {} as Record<string, unknown> };
  const fetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
    assertEquals(String(input), 'https://api.tavily.com/search');
    sent.headers = new Headers(init?.headers);
    sent.body = JSON.parse(String(init?.body));
    return Promise.resolve(Response.json({
      results: [
        { url: 'https://ex.com/a#x', title: 'A', content: '...' },
        { url: 'https://ex.com/a', title: 'A de novo', content: '...' },
        { url: 'mailto:x@y', title: 'ruim', content: '' },
      ],
    }));
  }) as typeof fetch;

  const r = await tavilySearch('"Dom Casmurro" resumo', 'tvly-teste', fetchFn);
  assertEquals(r, { results: [{ url: 'https://ex.com/a', title: 'A' }], credits: 1 });
  assertEquals(sent.headers.get('authorization'), 'Bearer tvly-teste');
  assertEquals([sent.body.search_depth, sent.body.max_results, sent.body.include_raw_content], ['basic', 8, false]);
});

Deno.test('tavilySearch: 429 lança HttpStatusError', async () => {
  const fetchFn = (() => Promise.resolve(new Response('limite', { status: 429 }))) as typeof fetch;
  await assertRejects(() => tavilySearch('q', 'k', fetchFn), HttpStatusError);
});
