import { assert, assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { PermanentStepError } from '../queue.ts';
import { UnsafeUrlError } from '../ssrf.ts';
import {
  countWords,
  DomainThrottle,
  type FetchDeps,
  fetchPage,
  fetchRobots,
  htmlToText,
  MAX_REDIRECTS,
  MAX_BYTES,
  readLimited,
  SourceRejectedError,
} from './fetch-page.ts';

// HTML sintético (repositório público: nada de página real de terceiros).
const HTML = `<!doctype html><html lang="pt"><head><title>Resumo sintético</title></head><body>
<nav>menu menu menu</nav>
<article><h1>Capítulo 1</h1><p>${'Personagem A encontra personagem B na praça. '.repeat(30)}</p>
<p>${'Os dois conversam sobre a viagem. '.repeat(30)}</p></article>
<footer>rodapé</footer></body></html>`;

function deps(routes: Record<string, () => Response>, resolved = ['93.184.216.34']): FetchDeps & { requested: string[]; slept: number[] } {
  const requested: string[] = [];
  const slept: number[] = [];
  let clock = 0;
  return {
    requested,
    slept,
    fetchFn: ((input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      const route = routes[url];
      return Promise.resolve(route ? route() : new Response('nada', { status: 404 }));
    }) as typeof fetch,
    resolve: () => Promise.resolve(resolved),
    sleep: (ms) => {
      slept.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
  };
}

Deno.test('htmlToText: extrai o conteúdo principal e o título', () => {
  const { title, text } = htmlToText(HTML);
  assertEquals(title, 'Resumo sintético');
  assertStringIncludes(text, 'Personagem A encontra personagem B');
  assert(countWords(text) > 150);
});

Deno.test('fetchPage: segue um redirecionamento e devolve texto de HTML', async () => {
  const d = deps({
    'https://ex.com/a': () => new Response(null, { status: 301, headers: { location: '/b' } }),
    'https://ex.com/b': () => new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  });
  const page = await fetchPage('https://ex.com/a', d, new DomainThrottle(d));
  assertEquals([page.finalUrl, page.status, page.kind], ['https://ex.com/b', 200, 'html']);
  assertStringIncludes(page.text, 'Os dois conversam');
});

Deno.test('fetchPage: redirecionamento para endereço interno é recusado', async () => {
  const d = deps({ 'https://ex.com/a': () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }) });
  await assertRejects(() => fetchPage('https://ex.com/a', d, new DomainThrottle(d)), UnsafeUrlError);
});

Deno.test('fetchPage: gancho antes de cada salto recusa o destino do redirecionamento sem requisitá-lo (BER-59)', async () => {
  const d = deps({ 'https://ex.com/a': () => new Response(null, { status: 302, headers: { location: 'https://pirata.example/livro' } }) });
  const vistos: string[] = [];
  const err = await assertRejects(
    () => fetchPage('https://ex.com/a', d, new DomainThrottle(d), (url) => {
      vistos.push(url.toString());
      return Promise.resolve(url.hostname === 'pirata.example' ? 'dominio_bloqueado' : null);
    }),
    SourceRejectedError,
  );
  assertEquals(err.reason, 'dominio_bloqueado');
  assertEquals(vistos, ['https://ex.com/a', 'https://pirata.example/livro']);
  assertEquals(d.requested, ['https://ex.com/a']);
});

Deno.test('fetchPage: redirecionamentos demais é recusa permanente com motivo (BER-59)', async () => {
  const routes: Record<string, () => Response> = {};
  for (let i = 0; i <= MAX_REDIRECTS + 1; i++) {
    routes[`https://ex.com/${i}`] = () => new Response(null, { status: 302, headers: { location: `/${i + 1}` } });
  }
  const d = deps(routes);
  const err = await assertRejects(() => fetchPage('https://ex.com/0', d, new DomainThrottle(d)), SourceRejectedError);
  assert(err instanceof PermanentStepError);
  assertEquals([err.reason, err.isBookFile], ['redirecionamentos_demais', false]);
});

Deno.test('fetchPage: corpo acima do limite é recusado com motivo; PDF grande conta como arquivo de livro (BER-59)', async () => {
  const grande = () => 'x'.repeat(MAX_BYTES + 1);
  const d = deps({
    'https://ex.com/livro.pdf': () => new Response(grande(), { headers: { 'content-type': 'application/pdf' } }),
    'https://ex.com/pagina': () => new Response(grande(), { headers: { 'content-type': 'text/html' } }),
  });
  const pdf = await assertRejects(() => fetchPage('https://ex.com/livro.pdf', d, new DomainThrottle(d)), SourceRejectedError);
  assertEquals([pdf.reason, pdf.isBookFile], ['arquivo_grande_demais', true]);
  const html = await assertRejects(() => fetchPage('https://ex.com/pagina', d, new DomainThrottle(d)), SourceRejectedError);
  assertEquals([html.reason, html.isBookFile], ['arquivo_grande_demais', false]);
});

Deno.test('fetchPage: PDF ilegível é recusado como formato não suportado (BER-59)', async () => {
  const d = deps({ 'https://ex.com/quebrado.pdf': () => new Response('isto não é um PDF', { headers: { 'content-type': 'application/pdf' } }) });
  const err = await assertRejects(() => fetchPage('https://ex.com/quebrado.pdf', d, new DomainThrottle(d)), SourceRejectedError);
  assertEquals(err.reason, 'formato_nao_suportado');
});

Deno.test('fetchPage: status de erro volta sem ler o corpo, para a política decidir', async () => {
  const d = deps({ 'https://ex.com/x': () => new Response('proibido', { status: 403 }) });
  const page = await fetchPage('https://ex.com/x', d, new DomainThrottle(d));
  assertEquals([page.status, page.text], [403, '']);
});

Deno.test('readLimited: corpo acima do limite é erro permanente', async () => {
  await assertRejects(() => readLimited(new Response('x'.repeat(20)), 10), PermanentStepError);
  const err = await assertRejects(() => readLimited(new Response('x'.repeat(20)), 10), SourceRejectedError);
  assertEquals(err.reason, 'arquivo_grande_demais');
  assertEquals((await readLimited(new Response('abc'), 10)).length, 3);
});

Deno.test('DomainThrottle: espera 2 s entre requisições ao mesmo domínio', async () => {
  const d = deps({});
  const throttle = new DomainThrottle(d);
  await throttle.wait('ex.com');
  await throttle.wait('ex.com');
  await throttle.wait('outro.com');
  assertEquals(d.slept, [2000]);
});

Deno.test('fetchRobots: 404 libera; 5xx bloqueia; arquivo é respeitado', async () => {
  const livre = deps({});
  assertEquals((await fetchRobots('https://ex.com', livre, new DomainThrottle(livre))).isAllowed('/x'), true);
  const fora = deps({ 'https://ex.com/robots.txt': () => new Response('erro', { status: 503 }) });
  assertEquals((await fetchRobots('https://ex.com', fora, new DomainThrottle(fora))).isAllowed('/x'), false);
  const regras = deps({ 'https://ex.com/robots.txt': () => new Response('User-agent: *\nDisallow: /privado') });
  const rules = await fetchRobots('https://ex.com', regras, new DomainThrottle(regras));
  assertEquals([rules.isAllowed('/privado/1'), rules.isAllowed('/livre')], [false, true]);
});
