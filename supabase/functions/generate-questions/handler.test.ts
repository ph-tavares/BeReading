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

Deno.test('generate-questions: capítulo sem conteúdo utilizável falha sem chamar a IA (BER-66)', async () => {
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
    const res = await handler(request({ chapter_id: 'ch-1' }));
    const json = await res.json();

    assertEquals(res.status, 422);
    assertEquals(String(json.error).startsWith('NO_CONTENT'), true);

    const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
    assertEquals(status?.status, 'failed');
    assertEquals(String(status?.error_message).startsWith('NO_CONTENT'), true);
  } finally {
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
