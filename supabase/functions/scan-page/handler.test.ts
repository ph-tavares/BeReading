// supabase/functions/scan-page/handler.test.ts
// BER-100: o handler de verdade, contra o fake do Supabase e a IA interceptada
// (BER-49) — nada aqui redefine uma cópia da lógica.
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { withMockedAIFetch } from '../_shared/test-support/mockAI.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';
const BOOK_ID = 'book-1';

/** Uma foto de 1x1 em base64 — o conteúdo não importa, a IA está interceptada. */
const FOTO = 'iVBORw0KGgoAAAANSUhEUg==';

const RESPOSTA_DA_IA = JSON.stringify({
  is_book_page: true,
  page_text: 'Quem controla o passado controla o futuro; quem controla o presente controla o passado.',
  suggestions: ['o que é duplipensar', 'me explica esse trecho com outras palavras', 'o que é o Ministério da Verdade'],
  detected_page: 220,
});

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'chave-de-teste');
  Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/scan-page', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function fixtures() {
  return {
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      books: [{ id: BOOK_ID, title: '1984', author: 'George Orwell', total_pages: 328 }],
      student_books: [{ id: 'sb-1', user_id: USER_ID, book_id: BOOK_ID, status: 'reading', current_page: 200 }],
      chapters: [
        { id: 'ch-8', book_id: BOOK_ID, number: 8, start_page: 180, end_page: 210 },
        { id: 'ch-9', book_id: BOOK_ID, number: 9, start_page: 211, end_page: 236 },
      ],
      assistant_conversations: [],
      assistant_messages: [],
    },
  };
}

const foto = { image_base64: FOTO, image_media_type: 'image/jpeg' };

Deno.test('scan-page: a foto devolve transcrição, sugestões e a página detectada', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(RESPOSTA_DA_IA, () =>
      handler(request({ ...foto, book_id: BOOK_ID })));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.suggestions.length, 3);
    assertEquals(json.data.detected_page, 220);
    assertEquals(json.data.registered_page, 200);
    assertEquals(json.data.book, { id: BOOK_ID, title: '1984', author: 'George Orwell' });
    // A página 220 cai no capítulo 9 (211–236).
    assertEquals(json.data.chapter_number, 9);

    assertEquals(fake.tables.assistant_conversations.length, 1);
    assertEquals(fake.tables.assistant_conversations[0].user_id, USER_ID);
    assertEquals(fake.tables.assistant_conversations[0].detected_page, 220);

    // A transcrição vira mensagem da conversa (spec §5), não coluna própria.
    assertEquals(fake.tables.assistant_messages.length, 1);
    assertEquals(fake.tables.assistant_messages[0].kind, 'page_text');
    assertEquals(fake.tables.assistant_messages[0].source_kind, 'photo');
    assertEquals(fake.tables.assistant_messages[0].conversation_id, json.data.conversation_id);
  } finally {
    await fake.close();
  }
});

// Critério de aceite da issue: a imagem não é gravada, nem em tabela, nem em Storage.
Deno.test('scan-page: a imagem não fica gravada em lugar nenhum', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    await withMockedAIFetch(RESPOSTA_DA_IA, () => handler(request({ ...foto, book_id: BOOK_ID })));

    assertEquals(JSON.stringify(fake.tables).includes(FOTO), false, 'a foto não pode estar em nenhuma tabela');
    const storage = fake.calls.filter((c) => c.path.startsWith('/storage'));
    assertEquals(storage, [], 'nenhuma chamada ao Storage');
  } finally {
    await fake.close();
  }
});

// Decisão D20: o catálogo tem 3 livros e o leitor não consegue cadastrar o dele (BER-60).
Deno.test('scan-page: sem livro na estante, funciona igual — só sem o contexto do livro', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(RESPOSTA_DA_IA, () =>
      handler(request({ ...foto, book_title: 'Cálculo, volume 1' })));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.book, null);
    assertEquals(json.data.book_title_text, 'Cálculo, volume 1');
    assertEquals(json.data.chapter_number, null, 'sem livro não dá para saber o capítulo');
    assertEquals(fake.tables.assistant_conversations[0].book_id, null);
    assertEquals(fake.tables.assistant_conversations[0].book_title_text, 'Cálculo, volume 1');
  } finally {
    await fake.close();
  }
});

Deno.test('scan-page: a foto que não é página de livro é recusada sem gravar nada', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(JSON.stringify({ is_book_page: false }), () =>
      handler(request({ ...foto, book_id: BOOK_ID })));
    const json = await res.json();

    assertEquals(res.status, 422);
    assertEquals(json.error, 'not_a_book_page');
    assertEquals(fake.tables.assistant_conversations, []);
    assertEquals(fake.tables.assistant_messages, []);
  } finally {
    await fake.close();
  }
});

// BER-30: o dono da ação vem do JWT, nunca do corpo.
Deno.test('scan-page: sem JWT recusa com 401; corpo apontando outro leitor recusa com 403', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const semToken = await handler(request({ ...foto }, null));
    assertEquals(semToken.status, 401);

    const outroDono = await handler(request({ ...foto, user_id: 'user-2' }));
    assertEquals(outroDono.status, 403);

    assertEquals(fake.tables.assistant_conversations, [], 'nenhuma das duas chega a gravar');
  } finally {
    await fake.close();
  }
});

// Falha fechada (AGENTS.md §3.8): nunca uma resposta escrita sem olhar a foto.
Deno.test('scan-page: provedor sem suporte a imagem devolve 503 e avisa o time', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);
  Deno.env.set('AI_PROVIDER', 'provedor-sem-visao');
  Deno.env.set('AI_API_KEY', 'chave-de-teste');

  const erros: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => { erros.push(args.map(String).join(' ')); };

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ ...foto, book_id: BOOK_ID }));
    const json = await res.json();

    assertEquals(res.status, 503);
    assertEquals(json.error, 'ai_image_unsupported');
    assertEquals(fake.tables.assistant_conversations, []);
    assertStringIncludes(erros.join('\n'), '[ops-alert:scan-page]');
  } finally {
    console.error = consoleError;
    await fake.close();
    Deno.env.set('AI_PROVIDER', 'anthropic');
  }
});

Deno.test('scan-page: IA fora do ar não deixa conversa pela metade, e avisa o time', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  const erros: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => { erros.push(args.map(String).join(' ')); };

  try {
    const { handler } = await import('./index.ts');
    // Resposta que não é JSON nenhum: é o que um modelo devolve quando se recusa a responder.
    const res = await withMockedAIFetch('desculpe, não consegui', () =>
      handler(request({ ...foto, book_id: BOOK_ID })));
    const json = await res.json();

    assertEquals(res.status, 500);
    assertEquals(json.error, 'scan_failed');
    assertEquals(fake.tables.assistant_conversations, []);
    assertStringIncludes(erros.join('\n'), '[ops-alert:scan-page]');
  } finally {
    console.error = consoleError;
    await fake.close();
  }
});

Deno.test('scan-page: recusa pedido sem imagem, com livro inexistente ou com foto grande demais', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');

    const semImagem = await handler(request({ book_id: BOOK_ID }));
    assertEquals(semImagem.status, 400);

    const livroInexistente = await handler(request({ ...foto, book_id: 'book-404' }));
    assertEquals(livroInexistente.status, 404);

    const grandeDemais = await handler(request({ image_base64: 'A'.repeat(8_000_000), image_media_type: 'image/jpeg' }));
    assertEquals(grandeDemais.status, 413);

    assertEquals(fake.tables.assistant_conversations, []);
  } finally {
    await fake.close();
  }
});

// A página impressa no cabeçalho ("1984") é a leitura errada clássica — e ela viraria
// a oferta de "registrar até aqui" da BER-104.
Deno.test('scan-page: página detectada fora do livro não vira posição', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const resposta = JSON.stringify({
      is_book_page: true,
      page_text: 'trecho',
      suggestions: ['o que é duplipensar'],
      detected_page: 1984,
    });
    const res = await withMockedAIFetch(resposta, () => handler(request({ ...foto, book_id: BOOK_ID })));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.detected_page, null);
    assertEquals(json.data.chapter_number, null);
  } finally {
    await fake.close();
  }
});

// A imagem vai antes do texto, e é a foto que o leitor mandou (_shared/ai.ts, BER-100).
Deno.test('scan-page: manda a foto para o modelo, antes do prompt', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);
  const corpos: unknown[] = [];

  try {
    const { handler } = await import('./index.ts');
    await withMockedAIFetch(RESPOSTA_DA_IA, () => handler(request({ ...foto, book_id: BOOK_ID })), corpos);

    const content = (corpos[0] as { messages: { content: unknown[] }[] }).messages[0].content;
    assertEquals((content[0] as { type: string }).type, 'image');
    assertEquals((content[0] as { source: { data: string } }).source.data, FOTO);
    assertEquals((content[1] as { type: string }).type, 'text');
    assertStringIncludes((content[1] as { text: string }).text, '1984');
  } finally {
    await fake.close();
  }
});
