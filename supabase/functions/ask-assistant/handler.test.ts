// supabase/functions/ask-assistant/handler.test.ts
// BER-101: o handler de verdade, contra o fake do Supabase e a IA interceptada (BER-49).
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { withMockedAIFetch } from '../_shared/test-support/mockAI.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';
const OUTRO_TOKEN = 'jwt-outro-leitor';
const OUTRO_USER = 'user-2';
const CONVERSA = 'conv-1';
const BOOK_ID = 'book-1';

const RESPOSTA_DA_IA = JSON.stringify({
  kind: 'direct',
  answer: 'É a capacidade de sustentar duas ideias contrárias ao mesmo tempo e aceitar as duas.',
});

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'chave-de-teste');
  Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/ask-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** A linha de conversa, anotada porque os testes trocam o livro por `null` (o caminho D20). */
interface ConversaRow {
  id: string;
  user_id: string;
  book_id: string | null;
  chapter_number: number | null;
  book_title_text: string | null;
  last_message_at: string;
  [key: string]: unknown;
}

function fixtures() {
  const conversas: ConversaRow[] = [
    { id: CONVERSA, user_id: USER_ID, book_id: BOOK_ID, chapter_number: 9, book_title_text: null, last_message_at: '2026-09-21T00:00:00.000Z' },
  ];
  return {
    users: { [TOKEN]: { id: USER_ID }, [OUTRO_TOKEN]: { id: OUTRO_USER } },
    tables: {
      books: [{ id: BOOK_ID, title: '1984', author: 'George Orwell', total_pages: 328 }],
      assistant_conversations: conversas,
      assistant_messages: [
        {
          id: 'msg-1',
          conversation_id: CONVERSA,
          user_id: USER_ID,
          role: 'reader',
          kind: 'page_text',
          content: 'Quem controla o passado controla o futuro.',
          created_at: '2026-09-21T00:00:00.000Z',
        },
      ],
    },
  };
}

const pergunta = { conversation_id: CONVERSA, question: 'o que é duplipensar' };

Deno.test('ask-assistant: responde e grava a pergunta e a resposta', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(RESPOSTA_DA_IA, () => handler(request(pergunta)));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.kind, 'direct');
    assertStringIncludes(json.data.answer, 'duas ideias contrárias');

    // A transcrição já estava lá; entram mais duas falas, nesta ordem.
    assertEquals(fake.tables.assistant_messages.length, 3);
    const novas = fake.tables.assistant_messages.slice(1);
    assertEquals(novas[0].kind, 'question');
    assertEquals(novas[0].content, 'o que é duplipensar');
    assertEquals(novas[1].kind, 'answer');
    assertEquals(novas[1].role, 'assistant');
    // O custo fica medido, não estimado.
    assertEquals(novas[1].model, 'claude-haiku-4-5');

    // A tela abre pela conversa mais recente (BER-102): a hora da última fala andou.
    assertEquals(fake.tables.assistant_conversations[0].last_message_at !== '2026-09-21T00:00:00.000Z', true);
  } finally {
    await fake.close();
  }
});

// O que o leitor tem na frente dele precisa chegar ao modelo.
Deno.test('ask-assistant: manda a página, o livro e o histórico no prompt', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);
  const corpos: unknown[] = [];

  try {
    const { handler } = await import('./index.ts');
    await withMockedAIFetch(RESPOSTA_DA_IA, () => handler(request(pergunta)), corpos);

    const prompt = (corpos[0] as { messages: { content: string }[] }).messages[0].content;
    assertStringIncludes(prompt, 'Quem controla o passado controla o futuro.');
    assertStringIncludes(prompt, '1984, de George Orwell, por volta do capítulo 9');
    assertStringIncludes(prompt, 'o que é duplipensar');
    assertStringIncludes(prompt, 'primeira pergunta da conversa');
  } finally {
    await fake.close();
  }
});

// BER-30: a conversa é buscada pelo id E pelo dono ao mesmo tempo.
Deno.test('ask-assistant: conversa de outro leitor responde 404, sem revelar que existe', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(pergunta, OUTRO_TOKEN));
    const json = await res.json();

    assertEquals(res.status, 404);
    assertEquals(json.error, 'Conversation not found');
    assertEquals(fake.tables.assistant_messages.length, 1, 'nada foi gravado');
  } finally {
    await fake.close();
  }
});

Deno.test('ask-assistant: sem JWT recusa com 401; corpo apontando outro leitor recusa com 403', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    assertEquals((await handler(request(pergunta, null))).status, 401);
    assertEquals((await handler(request({ ...pergunta, user_id: OUTRO_USER }))).status, 403);
    assertEquals(fake.tables.assistant_messages.length, 1);
  } finally {
    await fake.close();
  }
});

// Sem isto, uma string vazia viraria uma chamada de IA paga por nada.
Deno.test('ask-assistant: pergunta vazia ou conversa inexistente nem chamam a IA', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);
  let chamouIA = false;

  try {
    const { handler } = await import('./index.ts');
    await withMockedAIFetch(RESPOSTA_DA_IA, async () => {
      const semPergunta = await handler(request({ conversation_id: CONVERSA, question: '   ' }));
      assertEquals(semPergunta.status, 400);

      const semConversa = await handler(request({ conversation_id: 'conv-404', question: 'oi' }));
      assertEquals(semConversa.status, 404);

      const semNada = await handler(request({}));
      assertEquals(semNada.status, 400);
    }, []).then(() => { chamouIA = false; });

    assertEquals(chamouIA, false);
    assertEquals(fake.tables.assistant_messages.length, 1);
  } finally {
    await fake.close();
  }
});

Deno.test('ask-assistant: IA fora do ar não deixa pergunta sem par, e avisa o time', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);

  const erros: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => { erros.push(args.map(String).join(' ')); };

  try {
    const { handler } = await import('./index.ts');
    // Resposta que não é JSON nenhum: é o que um modelo devolve quando se recusa a responder.
    const res = await withMockedAIFetch('desculpe, não consegui', () => handler(request(pergunta)));

    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, 'answer_failed');
    assertEquals(fake.tables.assistant_messages.length, 1, 'a pergunta não fica sozinha na conversa');
    assertStringIncludes(erros.join('\n'), '[ops-alert:ask-assistant]');
  } finally {
    console.error = consoleError;
    await fake.close();
  }
});

// D20: sem livro na estante, a conversa segue com o título que o leitor digitou.
Deno.test('ask-assistant: conversa sem livro usa o título digitado', async () => {
  const base = fixtures();
  base.tables.assistant_conversations = [
    { id: CONVERSA, user_id: USER_ID, book_id: null, chapter_number: null, book_title_text: 'Cálculo, volume 1', last_message_at: '2026-09-21T00:00:00.000Z' },
  ];
  const fake = startFakeSupabase(base);
  withEnv(fake.url);
  const corpos: unknown[] = [];

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(RESPOSTA_DA_IA, () => handler(request(pergunta)), corpos);
    assertEquals(res.status, 200);

    const prompt = (corpos[0] as { messages: { content: string }[] }).messages[0].content;
    assertStringIncludes(prompt, 'Livro: Cálculo, volume 1');
  } finally {
    await fake.close();
  }
});

Deno.test('ask-assistant: método errado devolve 405', async () => {
  const fake = startFakeSupabase(fixtures());
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(new Request('http://localhost/ask-assistant', { method: 'GET' }));
    assertEquals(res.status, 405);
  } finally {
    await fake.close();
  }
});
