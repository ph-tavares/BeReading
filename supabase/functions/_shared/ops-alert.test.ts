// supabase/functions/_shared/ops-alert.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { notifyOps } from './ops-alert.ts';

Deno.test('notifyOps: sem OPS_ALERT_WEBHOOK_URL, não tenta chamar fetch nenhum', async () => {
  Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (() => {
    called = true;
    return Promise.resolve(new Response('{}'));
  }) as typeof fetch;

  try {
    await notifyOps('generate-questions', 'falhou para o capítulo ch-1');
    assertEquals(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('notifyOps: com a env configurada, dispara o webhook com o texto', async () => {
  Deno.env.set('OPS_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alert');
  const originalFetch = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response('{}'));
  }) as typeof fetch;

  try {
    await notifyOps('evaluate-answer', 'avaliação falhou para a resposta a1');
    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, 'https://hooks.example.com/alert');
    assertEquals(
      (calls[0].body as { text: string }).text,
      '[BeReading:evaluate-answer] avaliação falhou para a resposta a1',
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
  }
});

Deno.test('notifyOps: o webhook falhando não lança — quem chamou já estava lidando com outra falha', async () => {
  Deno.env.set('OPS_ALERT_WEBHOOK_URL', 'https://hooks.example.com/alert');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;

  try {
    await notifyOps('generate-questions', 'teste');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('OPS_ALERT_WEBHOOK_URL');
  }
});
