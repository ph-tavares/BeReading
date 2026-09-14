// supabase/functions/loop.integration.test.ts
// BER-49: teste de integração do loop central do produto — registrar leitura →
// gerar perguntas → avaliar resposta — que a auditoria apontou como inexistente.
// Os três handlers reais são exercitados, encadeados como em produção: o
// dispatch em segundo plano de `register-reading-session` é redirecionado para
// o handler real de `generate-questions` (em vez de uma rede de verdade), e a
// IA é interceptada nas duas pontas. O Supabase é o fake local
// (_shared/test-support/fakeSupabase.ts).
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from './_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';
const SERVICE_KEY = 'service-role-key-teste';

const CHAPTER_CONTENT = 'Era uma vez, num reino distante, '.repeat(10); // >= 200 chars
const QUESTIONS_AI_RESPONSE = JSON.stringify([
  { type: 'comprehension', question_text: 'O que aconteceu no capítulo?' },
  { type: 'reflection', question_text: 'Como isso se relaciona com sua vida?' },
]);
const EVALUATION_AI_RESPONSE = JSON.stringify({ score: 91, feedback: 'Leitura atenta do trecho.' });

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

Deno.test({
  name: 'loop crítico: registrar leitura → gerar perguntas → avaliar resposta',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const fake = startFakeSupabase({
      users: { [TOKEN]: { id: USER_ID } },
      tables: {
        books: [{ id: 'book-1', total_pages: 50 }],
        reading_sessions: [],
        student_books: [],
        streaks: [],
        chapters: [{
          id: 'ch-1', book_id: 'book-1', number: 1, end_page: 50, title: 'Capítulo 1',
          book_contents: { content_text: CHAPTER_CONTENT },
          books: { title: 'Livro de Teste', author: 'Autora Teste' },
        }],
        chapter_quiz_status: [],
        questions: [],
        answers: [],
      },
    });

    Deno.env.set('SUPABASE_URL', fake.url);
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
    Deno.env.set('AI_PROVIDER', 'openai');
    Deno.env.set('AI_API_KEY', 'fake-ai-key');

    const { handler: registerHandler } = await import('./register-reading-session/index.ts');
    const { handler: generateHandler } = await import('./generate-questions/index.ts');
    const { handler: evaluateHandler } = await import('./evaluate-answer/index.ts');

    const originalFetch = globalThis.fetch;
    const pendingGeneration: Promise<unknown>[] = [];

    // Encadeia o dispatch em segundo plano do register-reading-session direto no
    // handler real do generate-questions — é isso que acontece em produção, só
    // que via HTTP; aqui, na mesma máquina de teste, chamamos a função.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);

      if (url.startsWith(`${fake.url}/functions/v1/generate-questions`)) {
        const call = generateHandler(new Request(url, init));
        pendingGeneration.push(call);
        return await call;
      }
      if (url.startsWith(`${fake.url}/functions/v1/award-badges`)) {
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.startsWith('https://api.openai.com/')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: QUESTIONS_AI_RESPONSE } }],
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;

    try {
      // 1) Registrar leitura das páginas 1-50 completa o (único) capítulo do livro.
      const registerRes = await registerHandler(new Request('http://localhost/register-reading-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ user_id: USER_ID, book_id: 'book-1', start_page: 1, end_page: 50 }),
      }));
      const registerJson = await registerRes.json();
      assertEquals(registerRes.status, 200);
      assertEquals(registerJson.data.completed_chapter_ids, ['ch-1']);

      // 2) O dispatch em segundo plano ainda não foi aguardado pelo handler —
      // esperamos a chamada encadeada ao generate-questions terminar de verdade.
      await Promise.all(pendingGeneration);

      assertEquals(fake.tables.questions.length, 2);
      const status = fake.tables.chapter_quiz_status.find((s) => s.chapter_id === 'ch-1');
      assertEquals(status?.status, 'generated');

      // 3) Avaliar a resposta do leitor para uma das perguntas geradas — troca a
      // IA por uma avaliação fixa para a segunda perna do loop.
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.startsWith('https://api.openai.com/')) {
          return new Response(JSON.stringify({
            choices: [{ message: { content: EVALUATION_AI_RESPONSE } }],
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input as RequestInfo, init);
      }) as typeof fetch;

      const question = fake.tables.questions[0];
      const evaluateRes = await evaluateHandler(new Request('http://localhost/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ question_id: question.id, user_id: USER_ID, answer_text: 'minha resposta sobre o capítulo' }),
      }));
      const evaluateJson = await evaluateRes.json();

      assertEquals(evaluateRes.status, 200);
      assertEquals(evaluateJson.data.score, 91);
      assertEquals(fake.tables.answers.length, 1);
      assertEquals(fake.tables.answers[0].evaluation_status, 'completed');
      assertEquals(fake.tables.answers[0].question_id, question.id);
    } finally {
      globalThis.fetch = originalFetch;
      await fake.close();
    }
  },
});
