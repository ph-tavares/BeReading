// supabase/functions/evaluate-answer/handler.test.ts
// BER-49: cobertura de handler (IO, Supabase, chamada de IA, os dois caminhos —
// app e cron de reavaliação) que faltava — só o prompt/parsing tinha teste.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { withMockedAIFetch } from '../_shared/test-support/mockAI.ts';

const SERVICE_KEY = 'service-role-key-teste';
const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  Deno.env.set('AI_PROVIDER', 'openai');
  Deno.env.set('AI_API_KEY', 'fake-ai-key');
}

function request(body: unknown, authorization: string | null): Request {
  return new Request('http://localhost/evaluate-answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_EVALUATION = JSON.stringify({ score: 88, feedback: 'Boa leitura do trecho, faltou aprofundar.' });

Deno.test('evaluate-answer: campos obrigatórios ausentes devolvem 400', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } } });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: '  ' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 400);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: caminho do app — avalia, salva a nota e o feedback', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      questions: [{
        id: 'q1',
        question_text: 'O que motivou a personagem?',
        type: 'comprehension',
        chapter_id: 'ch-1',
        chapters: { book_contents: { content_text: 'conteúdo do capítulo' } },
      }],
      answers: [],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.score, 88);
    assertEquals(json.data.feedback, 'Boa leitura do trecho, faltou aprofundar.');

    assertEquals(fake.tables.answers.length, 1);
    assertEquals(fake.tables.answers[0].comprehension_score, 88);
    assertEquals(fake.tables.answers[0].evaluation_status, 'completed');
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: pergunta inexistente devolve 404 e não cria resposta', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { questions: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q-inexistente', user_id: USER_ID, answer_text: 'resposta' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 404);
    assertEquals(fake.tables.answers.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: user_id do corpo diferente do JWT devolve 403 (BER-30)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { questions: [{ id: 'q1', question_text: 'P?', type: 'comprehension', chapters: {} }], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: 'outro-usuario', answer_text: 'resposta' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 403);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: caminho do cron (service_role) — reavalia uma resposta pendente (BER-36)', async () => {
  const fake = startFakeSupabase({
    tables: {
      answers: [{
        id: 'a1',
        answer_text: 'minha resposta',
        evaluation_status: 'pending',
        questions: {
          question_text: 'O que motivou a personagem?',
          type: 'comprehension',
          chapters: { book_contents: { content_text: 'conteúdo do capítulo' } },
        },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ answer_id: 'a1' }, `Bearer ${SERVICE_KEY}`)),
    );
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.status, 'evaluated');
    assertEquals(fake.tables.answers[0].comprehension_score, 88);
    assertEquals(fake.tables.answers[0].evaluation_status, 'completed');
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: cron não reavalia o que já está completed (corrida com o app)', async () => {
  const fake = startFakeSupabase({
    tables: {
      answers: [{ id: 'a1', answer_text: 'x', evaluation_status: 'completed', comprehension_score: 70, questions: {} }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ answer_id: 'a1' }, `Bearer ${SERVICE_KEY}`));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.status, 'already-evaluated');
    assertEquals(fake.tables.answers[0].comprehension_score, 70); // não sobrescreveu
  } finally {
    await fake.close();
  }
});
