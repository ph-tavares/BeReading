// supabase/functions/retry-pending-quizzes/handler.test.ts
// BER-39: cobertura do alerta de "esgotou as tentativas e não vai se resolver
// sozinho" — item (2) da proposta, sem agendar nada novo (ver comentário em
// index.ts sobre por que isto vive no cron que já existe).
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const SERVICE_KEY = 'service-role-key-teste';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  Deno.env.delete('CRON_SECRET');
  Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
}

function request(): Request {
  return new Request('http://localhost/retry-pending-quizzes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

/** Intercepta o webhook de alerta (fetch) sem tocar no fake Supabase, que é HTTP de verdade. */
function captureOpsAlerts(): { calls: unknown[]; restore: () => void } {
  Deno.env.set('OPS_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alert');
  const original = globalThis.fetch;
  const calls: unknown[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://hooks.example.com/alert') {
      calls.push(JSON.parse(String(init?.body)));
      return Promise.resolve(new Response('{}'));
    }
    return original(input as RequestInfo, init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test({
  name: 'retry-pending-quizzes: sem nada abandonado, não dispara alerta',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const fake = startFakeSupabase({
      tables: {
        chapter_quiz_status: [{ chapter_id: 'ch-1', status: 'generated', attempts: 1 }],
        answers: [{ id: 'a1', evaluation_status: 'completed', answered_at: new Date().toISOString() }],
      },
    });
    withEnv(fake.url);
    const alerts = captureOpsAlerts();

    try {
      const { handler } = await import('./index.ts');
      const res = await handler(request());
      const json = await res.json();

      assertEquals(res.status, 200);
      assertEquals(json.data.abandoned, { quizzes: 0, answers: 0 });
      assertEquals(alerts.calls.length, 0);
    } finally {
      alerts.restore();
      await fake.close();
    }
  },
});

Deno.test({
  name: 'retry-pending-quizzes: capítulo e resposta que esgotaram as tentativas disparam o alerta (BER-39)',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const longAgo = new Date(Date.now() - 7 * 3600 * 1000).toISOString(); // > 6h de desistência
    const fake = startFakeSupabase({
      tables: {
        chapter_quiz_status: [
          { chapter_id: 'ch-1', status: 'failed', attempts: 3, last_attempt_at: longAgo },
        ],
        answers: [
          { id: 'a1', evaluation_status: 'failed', answered_at: longAgo },
        ],
      },
    });
    withEnv(fake.url);
    const alerts = captureOpsAlerts();

    try {
      const { handler } = await import('./index.ts');
      const res = await handler(request());
      const json = await res.json();

      assertEquals(res.status, 200);
      assertEquals(json.data.abandoned, { quizzes: 1, answers: 1 });
      assertEquals(alerts.calls.length, 1);
      assertEquals(
        (alerts.calls[0] as { text: string }).text,
        '[BeReading:retry-pending-quizzes] 1 capítulo(s) e 1 resposta(s) esgotaram as tentativas e não vão se resolver sozinhos.',
      );
    } finally {
      alerts.restore();
      await fake.close();
    }
  },
});
