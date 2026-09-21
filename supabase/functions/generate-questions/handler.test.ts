// supabase/functions/generate-questions/handler.test.ts
// BER-49: cobertura de handler (IO, Supabase, chamada de IA) que faltava — só a
// lógica pura (prompt, parsing) tinha teste. A IA é interceptada via
// _shared/test-support/mockAI.ts; o Supabase, via fakeSupabase.ts.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { withFailingAIFetch, withMockedAIFetch } from '../_shared/test-support/mockAI.ts';

const SERVICE_KEY = 'service-role-key-teste';
const CONTENT_200_CHARS = 'A'.repeat(210); // >= MIN_CONTENT_CHARS (200)

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  Deno.env.set('AI_PROVIDER', 'openai');
  Deno.env.set('AI_API_KEY', 'fake-ai-key');
  Deno.env.delete('TAVILY_API_KEY');
}

function request(body: unknown, token: string | null = SERVICE_KEY): Request {
  return new Request('http://localhost/generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_AI_RESPONSE = JSON.stringify([
  { type: 'comprehension', question_text: 'O que aconteceu no capítulo?' },
  { type: 'reflection', question_text: 'Como isso se relaciona com sua vida?' },
]);

Deno.test('generate-questions: sem a service_role key devolve 401', async () => {
  const fake = startFakeSupabase();
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ chapter_id: 'ch-1' }, 'chave-errada'));
    assertEquals(res.status, 401);
  } finally {
    await fake.close();
  }
});

Deno.test('generate-questions: aceita a secret key nova no header apikey e usa-a no banco (BER-76)', async () => {
  const fake = startFakeSupabase({
    tables: { questions: [{ id: 'q1', chapter_id: 'ch-1' }] },
  });
  withEnv(fake.url);
  Deno.env.set('SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'sb_secret_teste' }));

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(new Request('http://localhost/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: 'sb_secret_teste' },
      body: JSON.stringify({ chapter_id: 'ch-1' }),
    }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.cached, true);

    // Com a secret key configurada, uma chave errada continua sendo recusada.
    const chaveErrada = await handler(request({ chapter_id: 'ch-1' }, 'sb_secret_errada'));
    assertEquals(chaveErrada.status, 401);
  } finally {
    Deno.env.delete('SUPABASE_SECRET_KEYS');
    await fake.close();
  }
});

Deno.test('generate-questions: perguntas já existem — devolve cached=true sem chamar a IA', async () => {
  const fake = startFakeSupabase({
    tables: { questions: [{ id: 'q1', chapter_id: 'ch-1' }] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ chapter_id: 'ch-1' }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.cached, true);
  } finally {
    await fake.close();
  }
});

// BER-60: sem conteúdo nem busca na web, o capítulo ainda ganha quiz, com perguntas sobre a leitura
// da pessoa. O que o BER-66 proibia continua proibido: o prompt não deixa o modelo supor nada.
Deno.test('generate-questions: sem conteúdo nem web, gera perguntas sobre a leitura, sem supor fatos (BER-60)', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [{
        id: 'ch-1', number: 1, title: 'Cap 1', book_id: 'book-1',
        book_contents: { content_text: 'muito curto' },
        books: { title: 'Livro', author: 'Autor' },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const requests: unknown[] = [];
    const res = await withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' })), requests);

    assertEquals(res.status, 200);
    assertEquals(JSON.stringify(requests[0]).includes('NÃO deve supor nada'), true);
    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'generated');
    assertEquals((status?.grounding as { origem?: string })?.origem, 'leitura');
    assertEquals(fake.tables.questions.length, 2);
  } finally {
    await fake.close();
  }
});

/** Tavily dublado: devolve `body` para qualquer busca e guarda as consultas. */
async function withMockedTavily<T>(body: unknown, fn: () => Promise<T>, consultas: string[] = []): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://api.tavily.com/')) {
      consultas.push(JSON.parse(String(init?.body)).query);
      return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    }
    return original(input as RequestInfo, init);
  }) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const TRECHO = 'No primeiro capítulo, Bilbo Bolseiro recebe a visita de Gandalf e de treze anões, que o convidam para ' +
  'recuperar o tesouro guardado pelo dragão Smaug na Montanha Solitária. Bilbo hesita, mas acaba aceitando.';

Deno.test('generate-questions: sem conteúdo, busca o capítulo na web e guarda só o resumo da IA (BER-60)', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      book_contents: [],
      chapters: [{
        id: 'ch-1', number: 1, title: 'Capítulo 1', book_id: 'book-1',
        book_contents: null, books: { title: 'O Hobbit', author: 'J. R. R. Tolkien' },
      }],
    },
  });
  withEnv(fake.url);
  Deno.env.set('TAVILY_API_KEY', 'tvly-teste');

  const resposta = JSON.stringify({
    resumo: 'Bilbo recebe Gandalf e os anões e aceita partir atrás do tesouro de Smaug.',
    perguntas: [
      { type: 'comprehension', question_text: 'Quem aparece na casa de Bilbo?' },
      { type: 'reflection', question_text: 'Por que você acha que ele aceitou?' },
    ],
  });
  try {
    const { handler } = await import('./index.ts');
    const consultas: string[] = [];
    const requests: unknown[] = [];
    const res = await withMockedTavily(
      { answer: null, results: [{ url: 'https://www.resumos.com.br/hobbit', content: TRECHO }] },
      () => withMockedAIFetch(resposta, () => handler(request({ chapter_id: 'ch-1' })), requests),
      consultas,
    );

    assertEquals(res.status, 200);
    assertEquals(consultas, ['"O Hobbit" J. R. R. Tolkien capítulo 1 resumo']);
    const prompt = JSON.stringify(requests[0]);
    assertEquals(prompt.includes('Montanha Solitária'), true);
    assertEquals(prompt.includes('NUNCA mencione nem insinue acontecimentos de capítulos seguintes'), true);

    assertEquals(fake.tables.questions.length, 2);
    // Guarda o resumo escrito pela IA, não o trecho da web.
    assertEquals(fake.tables.book_contents.map((b) => b.content_text), ['Bilbo recebe Gandalf e os anões e aceita partir atrás do tesouro de Smaug.']);
    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.grounding, { fontes: 1, dominios: ['resumos.com.br'], fatos: 0, status: 'partial', origem: 'web' });
  } finally {
    Deno.env.delete('TAVILY_API_KEY');
    await fake.close();
  }
});

Deno.test('generate-questions: busca na web sem resultado cai nas perguntas sobre a leitura (BER-60)', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [{ id: 'ch-1', number: 2, title: null, book_id: 'book-1', book_contents: null, books: { title: 'X', author: 'Y' } }],
    },
  });
  withEnv(fake.url);
  Deno.env.set('TAVILY_API_KEY', 'tvly-teste');
  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedTavily({ results: [] }, () => withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' }))));
    assertEquals(res.status, 200);
    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals((status?.grounding as { origem?: string })?.origem, 'leitura');
  } finally {
    Deno.env.delete('TAVILY_API_KEY');
    await fake.close();
  }
});

Deno.test('generate-questions: caminho feliz — gera e salva as perguntas, marca o capítulo como generated', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [{
        id: 'ch-1', number: 1, title: 'Cap 1', book_id: 'book-1',
        book_contents: { content_text: CONTENT_200_CHARS },
        books: { title: 'Livro', author: 'Autor' },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' })));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.questions_generated, 2);
    assertEquals(fake.tables.questions.length, 2);
    assertEquals(fake.tables.questions.every((q) => q.chapter_id === 'ch-1'), true);

    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'generated');
  } finally {
    await fake.close();
  }
});

Deno.test('generate-questions: fixa a temperatura da IA para consistência entre gerações (BER-55)', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [{
        id: 'ch-1', number: 1, title: 'Cap 1', book_id: 'book-1',
        book_contents: { content_text: CONTENT_200_CHARS },
        books: { title: 'Livro', author: 'Autor' },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const requests: unknown[] = [];
    await withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' })), requests);

    assertEquals(requests.length, 1);
    assertEquals((requests[0] as { temperature: number }).temperature, 0.4);
  } finally {
    await fake.close();
  }
});

Deno.test('generate-questions: falha da IA marca o capítulo como failed para o retry (BER-27/BER-36)', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [{
        id: 'ch-1', number: 1, title: 'Cap 1', book_id: 'book-1',
        book_contents: { content_text: CONTENT_200_CHARS },
        books: { title: 'Livro', author: 'Autor' },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withFailingAIFetch(500, () => handler(request({ chapter_id: 'ch-1' })));

    assertEquals(res.status, 500);
    assertEquals(fake.tables.questions.length, 0);

    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'failed');
  } finally {
    await fake.close();
  }
});

// BER-59: capítulo sem texto no catálogo, mas com conhecimento verificado da edição ligada ao livro.
// O app chama o capítulo de "Parte 2 - Capítulo 1"; na edição ele é o 3º (a parte recomeça a contagem).
Deno.test('generate-questions: usa o conhecimento verificado da edição e grava de onde ele veio', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      chapters: [
        { id: 'ch-a', number: 1, title: 'Parte 1 - Capítulo 1', book_id: 'book-1' },
        {
          id: 'ch-1', number: 2, title: 'Parte 2 - Capítulo 1', book_id: 'book-1',
          book_contents: null, books: { title: '1984', author: 'George Orwell' },
        },
      ],
      book_editions: [{ id: 'ed-1', book_id: 'book-1', created_at: '2026-09-17T00:00:00Z' }],
      edition_chapters: [1, 2, 3, 4].map((n) => ({
        id: `ec-${n}`, edition_id: 'ed-1', number: n, part_label: null, number_in_part: n <= 2 ? n : n - 2, title: null,
      })),
      chapter_knowledge: [
        { id: 'k-3', edition_chapter_id: 'ec-3', status: 'confirmed', confidence: 0.95, summary: '', recheck_count: 0 },
        { id: 'k-4', edition_chapter_id: 'ec-4', status: 'confirmed', confidence: 0.95, summary: '', recheck_count: 0 },
      ],
      chapter_facts: [
        { id: 'f-1', chapter_knowledge_id: 'k-3', kind: 'event', statement: 'Julia entrega um bilhete a Winston.', is_interpretation: false, confidence: 1 },
        { id: 'f-2', chapter_knowledge_id: 'k-3', kind: 'event', statement: 'Os dois marcam um encontro no campo.', is_interpretation: false, confidence: 0.9 },
        { id: 'f-9', chapter_knowledge_id: 'k-4', kind: 'event', statement: 'FATO DO CAPÍTULO SEGUINTE.', is_interpretation: false, confidence: 1 },
      ],
      chapter_fact_sources: [
        { fact_id: 'f-1', source_id: 's-1' }, { fact_id: 'f-2', source_id: 's-2' }, { fact_id: 'f-9', source_id: 's-3' },
      ],
      ingestion_sources: [
        { id: 's-1', registrable_domain: 'wikipedia.org' },
        { id: 's-2', registrable_domain: 'uol.com.br' },
        { id: 's-3', registrable_domain: 'outro.com' },
      ],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const requests: unknown[] = [];
    const res = await withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' })), requests);

    assertEquals(res.status, 200);
    const prompt = JSON.stringify(requests[0]);
    assertEquals(prompt.includes('Julia entrega um bilhete a Winston.'), true);
    assertEquals(prompt.includes('FATO DO CAPÍTULO SEGUINTE'), false, 'nada do capítulo adiante entra no prompt');

    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'generated');
    assertEquals(status?.grounding, { fontes: 2, dominios: ['uol.com.br', 'wikipedia.org'], fatos: 2, status: 'confirmed' });
  } finally {
    await fake.close();
  }
});

// BER-60: o livro que um leitor cadastrou com o ISBN aproveita a edição que já foi ingerida,
// mesmo ligada (book_id) ao livro do catálogo.
Deno.test('generate-questions: livro do leitor usa a edição pelo ISBN quando ela serve a outro livro', async () => {
  const fake = startFakeSupabase({
    tables: {
      questions: [],
      books: [{ id: 'book-leitor', isbn: '9788535914849' }, { id: 'book-catalogo', isbn: null }],
      chapters: [
        {
          id: 'ch-1', number: 1, title: 'Parte 1 - Capítulo 1', book_id: 'book-leitor',
          book_contents: null, books: { title: '1984', author: 'George Orwell' },
        },
        { id: 'ch-2', number: 2, title: 'Parte 1 - Capítulo 2', book_id: 'book-leitor' },
      ],
      book_editions: [{ id: 'ed-1', book_id: 'book-catalogo', isbn: '9788535914849', created_at: '2026-09-17T00:00:00Z' }],
      edition_chapters: [1, 2].map((n) => ({ id: `ec-${n}`, edition_id: 'ed-1', number: n, part_label: 'Parte 1', number_in_part: n, title: null })),
      chapter_knowledge: [{ id: 'k-1', edition_chapter_id: 'ec-1', status: 'confirmed', confidence: 0.95, summary: '', recheck_count: 0 }],
      chapter_facts: [
        { id: 'f-1', chapter_knowledge_id: 'k-1', kind: 'event', statement: 'Winston volta para casa no Edifício Vitória.', is_interpretation: false, confidence: 1 },
        { id: 'f-2', chapter_knowledge_id: 'k-1', kind: 'event', statement: 'Winston começa um diário.', is_interpretation: false, confidence: 1 },
      ],
      chapter_fact_sources: [{ fact_id: 'f-1', source_id: 's-1' }, { fact_id: 'f-2', source_id: 's-2' }],
      ingestion_sources: [{ id: 's-1', registrable_domain: 'gutenberg.org' }, { id: 's-2', registrable_domain: 'historyhit.com' }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const requests: unknown[] = [];
    const res = await withMockedAIFetch(VALID_AI_RESPONSE, () => handler(request({ chapter_id: 'ch-1' })), requests);

    assertEquals(res.status, 200);
    assertEquals(JSON.stringify(requests[0]).includes('Winston começa um diário.'), true);
    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'generated');
  } finally {
    await fake.close();
  }
});
