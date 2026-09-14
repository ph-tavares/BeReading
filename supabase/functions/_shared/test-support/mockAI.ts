// supabase/functions/_shared/test-support/mockAI.ts
// BER-49: generate-questions e evaluate-answer chamam a IA via `fetch` direto
// para api.openai.com/api.anthropic.com — não há ponto de injeção. Em teste,
// interceptamos só essas duas URLs; tudo o mais (o fake Supabase) segue pela
// rede real, contra o servidor local.
//
// Helper de teste — não é código de produção.

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Roda `fn` com `fetch` interceptado: chamadas à OpenAI ou à Anthropic devolvem
 * `responseText` como o conteúdo gerado; qualquer outra URL segue para o fetch
 * original (o fake Supabase local).
 */
export async function withMockedAIFetch<T>(
  responseText: string,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);

    if (url.startsWith('https://api.openai.com/')) {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: responseText } }],
      }), { headers: { 'Content-Type': 'application/json' } }));
    }

    if (url.startsWith('https://api.anthropic.com/')) {
      return Promise.resolve(new Response(JSON.stringify({
        content: [{ text: responseText }],
      }), { headers: { 'Content-Type': 'application/json' } }));
    }

    return original(input as RequestInfo, init);
  }) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

/** Como `withMockedAIFetch`, mas a chamada de IA falha com o status dado. */
export async function withFailingAIFetch<T>(
  status: number,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);

    if (url.startsWith('https://api.openai.com/') || url.startsWith('https://api.anthropic.com/')) {
      return Promise.resolve(new Response('rate limited', { status }));
    }

    return original(input as RequestInfo, init);
  }) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}
