import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { fakeContext, NOW, page, seedRun, stepRow } from '../../test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../../test-support/memoryIngestionStore.ts';
import { LIMITS } from '../budget.ts';
import { PermanentStepError } from '../queue.ts';
import { DomainThrottle, type FetchDeps, fetchPage, MAX_BYTES, MAX_REDIRECTS } from '../sources/fetch-page.ts';
import { UnsafeUrlError } from '../ssrf.ts';
import { DeferStepError } from './context.ts';
import { runDiscoverStep } from './discover.ts';
import { runEditionStep } from './edition.ts';
import { publisherDomainMatches, runFetchStep } from './fetch.ts';

// Texto sintético de resumo, com mais de 150 palavras (mínimo útil da política).
const RESUMO = 'No capítulo um, a personagem Ana chega à cidade e procura o irmão. '.repeat(20);

/** `fetchPage` de verdade sobre uma rede simulada: registra cada URL requisitada (BER-59). */
function redeFalsa(routes: Record<string, () => Response>) {
  const requested: string[] = [];
  const deps: FetchDeps = {
    fetchFn: ((input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      return Promise.resolve(routes[url]?.() ?? new Response('nada', { status: 404 }));
    }) as typeof fetch,
    resolve: () => Promise.resolve(['93.184.216.34']),
    sleep: () => Promise.resolve(),
    now: () => NOW,
  };
  const throttle = new DomainThrottle(deps);
  return {
    requested,
    fetchPage: (url: string, beforeRequest?: (url: URL) => Promise<string | null>) => fetchPage(url, deps, throttle, beforeRequest),
  };
}

Deno.test('edition: junta Open Library e Google Books, grava sumário ligado ao ISBN e enfileira buscas', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store, { title: null, authors: [], publisher: null, language: null });
  const ctx = fakeContext(store, {
    fetchEdition: () => Promise.resolve({
      title: 'Livro Sintético', authors: ['Autora Exemplo'], authorDeathYear: null, publishers: ['Editora Exemplo'], language: 'pt',
      publishYear: 2010, firstPublishYear: 2008, workKey: '/works/OL1W', originalLanguage: 'pt',
      tableOfContents: [{ number: 1, part: null, numberInPart: null, title: 'Um' }],
    }),
    fetchGoogle: () => Promise.reject(new Error('Google fora do ar')),
  });

  const outcome = await runEditionStep(stepRow(run, 'edition', edition.isbn), run, ctx);

  const saved = await store.getEdition(edition.id);
  assertEquals([saved.title, saved.publisher, saved.firstPublishYear, saved.originalLanguage], ['Livro Sintético', 'Editora Exemplo', 2008, 'pt']);
  assertEquals(store.sources.map((s) => [s.registrableDomain, s.tiedToIsbn, s.weight]), [['openlibrary.org', true, 'B']]);
  assertEquals(outcome.enqueue?.every((s) => s.kind === 'discover'), true);
  assertEquals(outcome.enqueue?.[0].subject, '"Livro Sintético" Autora Exemplo resumo por capítulo');
});

Deno.test('edition: sem título em nenhuma base é erro permanente', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run, edition } = await seedRun(store, { title: null });
  await assertRejects(() => runEditionStep(stepRow(run, 'edition', edition.isbn), run, fakeContext(store)), PermanentStepError);
});

Deno.test('discover: enfileira downloads novos, sem repetir, respeitando o teto de fontes', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  await store.enqueueSteps([{ runId: run.id, kind: 'fetch', subject: 'https://ja-conhecida.com/x' }]);
  const ctx = fakeContext(store, {
    search: () => Promise.resolve({
      results: [{ url: 'https://ja-conhecida.com/x', title: 'velha' }, { url: 'https://nova.com/y', title: 'nova' }],
      credits: 1,
    }),
  });
  const outcome = await runDiscoverStep(stepRow(run, 'discover', 'q'), run, ctx);
  assertEquals(outcome.enqueue, [{ kind: 'fetch', subject: 'https://nova.com/y', payload: { title: 'nova' } }]);
  assertEquals(outcome.stats, { buscas: 1, creditos_tavily: 1 });
  assertEquals(outcome.payload?.creditos, 1);
});

Deno.test('discover: pula quando o run bateu teto e adia quando a cota diária acabou', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const ctx = fakeContext(store);

  const noTeto = { ...run, stats: { buscas: LIMITS.maxSearchesPerRun } };
  assertEquals(await runDiscoverStep(stepRow(run, 'discover', 'q'), noTeto, ctx), { payload: { skipped: 'limite' }, runStatusReason: 'limite' });

  // BER-59: a cota diária conta os créditos dos `discover` terminados hoje, não as estatísticas do run.
  await store.enqueueSteps([{ runId: run.id, kind: 'discover', subject: 'gastou' }]);
  await store.finishStep(store.steps[0].id, { status: 'done', payload: { creditos: LIMITS.maxTavilyCreditsPerDay } });
  const err = await assertRejects(() => runDiscoverStep(stepRow(run, 'discover', 'q'), run, ctx), DeferStepError);
  assertEquals(err.until, '2026-09-17T00:05:00.000Z');
});

Deno.test('fetch: domínio bloqueado é rejeitado sem baixar nada', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  store.policies.push({ domain: 'pirata.example', policy: 'blocked', weight: null, sourceType: null, authorizesFullText: false, hostCountry: null });
  const { run } = await seedRun(store);
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://pirata.example/livro.pdf'), run, fakeContext(store));
  assertEquals(store.sources[0].rejectionReason, 'dominio_bloqueado');
  assertEquals(outcome.stats?.rejeitadas_dominio_bloqueado, 1);
});

Deno.test('fetch: URL para endereço interno vira rejeição registrada', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const ctx = fakeContext(store, { fetchPage: () => Promise.reject(new UnsafeUrlError('interno')) });
  await runFetchStep(stepRow(run, 'fetch', 'https://ex.com/x'), run, ctx);
  assertEquals(store.sources[0].rejectionReason, 'endereco_nao_publico');
});

Deno.test('fetch: resumo aceito guarda o texto temporário, a impressão e enfileira a extração', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const ctx = fakeContext(store, { fetchPage: (url) => Promise.resolve(page(url, `${RESUMO} ISBN 978-0-00-000000-1`)) });
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://blog.com/resumo', { title: 'Resumo' }), run, ctx);

  const source = store.sources[0];
  assertEquals([source.decision, source.sourceType, source.weight, source.tiedToIsbn], ['accepted', 'web', 'D', true]);
  assertEquals(source.contentFingerprint !== null, true);
  assertEquals(await store.getSourceText(source.id), `${RESUMO} ISBN 978-0-00-000000-1`);
  assertEquals(outcome.enqueue, [{ kind: 'extract', subject: `${source.id}#0` }]);
});

Deno.test('fetch: robots.txt que proíbe recusa antes de requisitar a página e não guarda texto (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const rede = redeFalsa({ 'https://blog.com/resumo': () => new Response(RESUMO, { headers: { 'content-type': 'text/plain' } }) });
  const ctx = fakeContext(store, { fetchPage: rede.fetchPage, fetchRobots: () => Promise.resolve({ isAllowed: () => false }) });
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://blog.com/resumo'), run, ctx);
  assertEquals(store.sources[0].rejectionReason, 'robots');
  assertEquals(outcome.stats?.rejeitadas_robots, 1);
  assertEquals(rede.requested, []);
  assertEquals(store.texts.size, 0);
});

Deno.test('fetch: redirecionamento para domínio bloqueado é recusado sem requisitar o destino (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  store.policies.push({ domain: 'pirata.example', policy: 'blocked', weight: null, sourceType: null, authorizesFullText: false, hostCountry: null });
  const { run } = await seedRun(store);
  const rede = redeFalsa({
    'https://blog.com/resumo': () => new Response(null, { status: 302, headers: { location: 'https://pirata.example/livro.pdf' } }),
    'https://pirata.example/livro.pdf': () => new Response(RESUMO, { headers: { 'content-type': 'text/plain' } }),
  });
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://blog.com/resumo'), run, fakeContext(store, { fetchPage: rede.fetchPage }));
  assertEquals([store.sources[0].rejectionReason, store.sources[0].url], ['dominio_bloqueado', 'https://blog.com/resumo']);
  assertEquals(outcome.stats?.rejeitadas_dominio_bloqueado, 1);
  assertEquals(rede.requested, ['https://blog.com/resumo']);
});

Deno.test('fetch: PDF acima do limite de tamanho vira fonte rejeitada e conta como PDF rejeitado (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const rede = redeFalsa({
    'https://arquivos.example/livro.pdf': () => new Response('x'.repeat(MAX_BYTES + 1), { headers: { 'content-type': 'application/pdf' } }),
  });
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://arquivos.example/livro.pdf'), run, fakeContext(store, { fetchPage: rede.fetchPage }));
  assertEquals([store.sources[0].decision, store.sources[0].rejectionReason, store.sources[0].isBookFile], ['rejected', 'arquivo_grande_demais', true]);
  assertEquals([outcome.stats?.rejeitadas_arquivo_grande_demais, outcome.stats?.pdfs_rejeitados], [1, 1]);
  assertEquals(outcome.payload, { decisao: 'rejected', motivo: 'arquivo_grande_demais' });
  assertEquals(store.texts.size, 0);
});

Deno.test('fetch: redirecionamentos demais viram fonte rejeitada com motivo (BER-59)', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store);
  const routes: Record<string, () => Response> = {};
  for (let i = 0; i <= MAX_REDIRECTS + 1; i++) {
    routes[`https://blog.com/${i}`] = () => new Response(null, { status: 302, headers: { location: `/${i + 1}` } });
  }
  const rede = redeFalsa(routes);
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://blog.com/0'), run, fakeContext(store, { fetchPage: rede.fetchPage }));
  assertEquals([store.sources[0].rejectionReason, store.sources[0].isBookFile], ['redirecionamentos_demais', false]);
  assertEquals([outcome.stats?.rejeitadas_redirecionamentos_demais, outcome.stats?.pdfs_rejeitados], [1, undefined]);
});

Deno.test('fetch: PDF de livro protegido sem autorização é rejeitado e contado', async () => {
  const store = new MemoryIngestionStore(() => NOW);
  const { run } = await seedRun(store, { originalLanguage: 'pt', firstPublishYear: 2010 });
  const ctx = fakeContext(store, {
    fetchPage: (url) => Promise.resolve(page(url, RESUMO.repeat(10), { kind: 'pdf', html: null, pdfPages: 300 })),
  });
  const outcome = await runFetchStep(stepRow(run, 'fetch', 'https://arquivos.example/livro.pdf'), run, ctx);
  assertEquals(store.sources[0].rejectionReason, 'texto_integral_sem_autorizacao');
  assertEquals(outcome.stats?.pdfs_rejeitados, 1);
  assertEquals(store.texts.size, 0);
});

Deno.test('publisherDomainMatches: domínio com o nome da editora', () => {
  assertEquals(publisherDomainMatches('companhiadasletras.com.br', 'Companhia das Letras'), true);
  assertEquals(publisherDomainMatches('intrinseca.com.br', 'Intrínseca'), true);
  assertEquals(publisherDomainMatches('blog.com', 'Companhia das Letras'), false);
  assertEquals(publisherDomainMatches('ab.com', 'AB'), false);
});

Deno.test('discover: créditos de busca terminada hoje contam mesmo com o run começado ontem (BER-59)', async () => {
  let clock = NOW - 24 * 60 * 60 * 1000;
  const store = new MemoryIngestionStore(() => clock);
  const ontem = await seedRun(store);
  await store.enqueueSteps([
    { runId: ontem.run.id, kind: 'discover', subject: 'terminou ontem' },
    { runId: ontem.run.id, kind: 'discover', subject: 'terminou hoje' },
  ]);
  await store.finishStep(store.steps[0].id, { status: 'done', payload: { creditos: LIMITS.maxTavilyCreditsPerDay } });
  clock = NOW;
  const hoje = await seedRun(store);
  let buscas = 0;
  const ctx = fakeContext(store, { search: () => (buscas++, Promise.resolve({ results: [], credits: 1 })) });

  // Só o de ontem: a cota de hoje está livre.
  await runDiscoverStep(stepRow(hoje.run, 'discover', 'q1'), hoje.run, ctx);
  assertEquals(buscas, 1);

  await store.finishStep(store.steps[1].id, { status: 'done', payload: { creditos: LIMITS.maxTavilyCreditsPerDay } });
  assertEquals(await store.sumTavilyCreditsSince(new Date(Date.UTC(2026, 8, 16)).toISOString()), LIMITS.maxTavilyCreditsPerDay);
  const err = await assertRejects(() => runDiscoverStep(stepRow(hoje.run, 'discover', 'q2'), hoje.run, ctx), DeferStepError);
  assertEquals([err.until, buscas], ['2026-09-17T00:05:00.000Z', 1]);
});
