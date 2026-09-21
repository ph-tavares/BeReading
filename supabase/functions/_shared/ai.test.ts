import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { AIHttpError, AIImageUnsupportedError, AIOutOfCreditsError, callAI, imageUnsupported, outOfCredits } from './ai.ts';

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function withFetch<T>(
  handler: (url: string, body: Record<string, unknown>) => Response,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(urlOf(input), JSON.parse(String(init?.body ?? '{}'))))) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test('callAI (anthropic): devolve texto, modelo e usage, repassando max_tokens e temperature', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  Deno.env.delete('ANTHROPIC_MODEL');
  let sent: Record<string, unknown> = {};
  const result = await withFetch((url, body) => {
    assertEquals(url, 'https://api.anthropic.com/v1/messages');
    sent = body;
    return Response.json({ content: [{ text: 'oi' }], usage: { input_tokens: 12, output_tokens: 3 } });
  }, () => callAI({ prompt: 'p', maxTokens: 500, temperature: 0.2 }));

  assertEquals(result, { text: 'oi', model: 'claude-haiku-4-5', usage: { inputTokens: 12, outputTokens: 3 } });
  assertEquals(sent.max_tokens, 500);
  assertEquals(sent.temperature, 0.2);
});

Deno.test('callAI (openai): lê usage de prompt_tokens/completion_tokens e omite temperature ausente', async () => {
  Deno.env.set('AI_PROVIDER', 'openai');
  Deno.env.set('AI_API_KEY', 'k');
  Deno.env.delete('AI_MODEL');
  let sent: Record<string, unknown> = {};
  const result = await withFetch((_url, body) => {
    sent = body;
    return Response.json({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 7, completion_tokens: 2 },
    });
  }, () => callAI({ prompt: 'p', maxTokens: 256 }));

  assertEquals(result.usage, { inputTokens: 7, outputTokens: 2 });
  assertEquals(result.model, 'gpt-4o-mini');
  assertEquals('temperature' in sent, false);
});

Deno.test('callAI: resposta sem usage conta zero, não quebra', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  const result = await withFetch(() => Response.json({ content: [{ text: 'x' }] }),
    () => callAI({ prompt: 'p', maxTokens: 10 }));
  assertEquals(result.usage, { inputTokens: 0, outputTokens: 0 });
});

Deno.test('callAI: status de erro vira exceção com o status na mensagem', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  await withFetch(() => new Response('limite', { status: 429 }), () =>
    assertRejects(() => callAI({ prompt: 'p', maxTokens: 10 }), Error, 'Anthropic API error 429'));
});

Deno.test('callAI: timeoutMs passa um AbortSignal ao fetch; sem ele, nenhum (BER-59)', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  const signals: unknown[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    signals.push(init?.signal);
    return Promise.resolve(Response.json({ content: [{ text: 'x' }] }));
  }) as typeof fetch;
  try {
    await callAI({ prompt: 'p', maxTokens: 10, timeoutMs: 60_000 });
    await callAI({ prompt: 'p', maxTokens: 10 });
  } finally {
    globalThis.fetch = original;
  }
  assertEquals(signals[0] instanceof AbortSignal, true);
  assertEquals(signals[1], undefined);
});

// Spec §11, item 41: saldo acabado é pausa, não falha.
Deno.test('outOfCredits: reconhece saldo esgotado nos dois provedores', () => {
  assertEquals(outOfCredits(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}'), true);
  assertEquals(outOfCredits(429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}'), true);
  assertEquals(outOfCredits(400, '{"error":{"message":"max_tokens is too large"}}'), false, 'outro 400 continua sendo erro do pedido');
  assertEquals(outOfCredits(500, 'erro interno'), false);
});

Deno.test('callAI: saldo esgotado vira AIOutOfCreditsError, não AIHttpError', async () => {
  const original = globalThis.fetch;
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'chave-de-teste');
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}', { status: 400 }),
    )) as typeof fetch;
  try {
    await assertRejects(() => callAI({ prompt: 'oi', maxTokens: 10 }), AIOutOfCreditsError);
  } finally {
    globalThis.fetch = original;
  }
});

// Spec §11, item 42: credencial de reserva entra só quando a principal acusa saldo esgotado.
Deno.test('callAI: saldo esgotado na principal cai para a credencial de reserva', async () => {
  const original = globalThis.fetch;
  const chamadas: { url: string; chave: string | null }[] = [];
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'chave-principal');
  Deno.env.set('ANTHROPIC_FALLBACK_API_KEY', 'chave-reserva');
  Deno.env.set('ANTHROPIC_FALLBACK_BASE_URL', 'https://gateway.example');
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const chave = new Headers(init?.headers).get('x-api-key');
    chamadas.push({ url: urlOf(input), chave });
    if (chave === 'chave-principal') {
      return Promise.resolve(new Response('{"error":{"message":"Your credit balance is too low"}}', { status: 400 }));
    }
    return Promise.resolve(Response.json({ content: [{ text: 'ok' }], usage: { input_tokens: 5, output_tokens: 2 } }));
  }) as typeof fetch;

  try {
    const resultado = await callAI({ prompt: 'oi', maxTokens: 10 });
    assertEquals(resultado.text, 'ok');
    assertEquals(chamadas.map((c) => c.chave), ['chave-principal', 'chave-reserva']);
    assertEquals(chamadas[1].url, 'https://gateway.example/v1/messages');
  } finally {
    globalThis.fetch = original;
    Deno.env.delete('ANTHROPIC_FALLBACK_API_KEY');
    Deno.env.delete('ANTHROPIC_FALLBACK_BASE_URL');
  }
});

Deno.test('callAI: sem credencial de reserva, o saldo esgotado continua pausando o run', async () => {
  const original = globalThis.fetch;
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'chave-principal');
  Deno.env.delete('ANTHROPIC_FALLBACK_API_KEY');
  globalThis.fetch = (() =>
    Promise.resolve(new Response('{"error":{"message":"Your credit balance is too low"}}', { status: 400 }))) as typeof fetch;
  try {
    await assertRejects(() => callAI({ prompt: 'oi', maxTokens: 10 }), AIOutOfCreditsError);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test('callAI: cabeçalho de autenticação vem da secret, com Bearer quando for Authorization', async () => {
  const original = globalThis.fetch;
  const cabecalhos: Headers[] = [];
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'credencial-do-gateway');
  Deno.env.set('ANTHROPIC_AUTH_HEADER', 'Authorization');
  Deno.env.set('ANTHROPIC_BASE_URL', 'https://gateway.example');
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    cabecalhos.push(new Headers(init?.headers));
    return Promise.resolve(Response.json({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }));
  }) as typeof fetch;

  try {
    await callAI({ prompt: 'oi', maxTokens: 10 });
    assertEquals(cabecalhos[0].get('authorization'), 'Bearer credencial-do-gateway');
    assertEquals(cabecalhos[0].get('x-api-key'), null);
  } finally {
    globalThis.fetch = original;
    Deno.env.delete('ANTHROPIC_AUTH_HEADER');
    Deno.env.delete('ANTHROPIC_BASE_URL');
  }
});

// BER-100: a foto da página. O bloco da imagem vai antes do texto nos dois provedores.
Deno.test('callAI (anthropic): imagem vira bloco base64 antes do texto', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  let sent: Record<string, unknown> = {};
  await withFetch((_url, body) => {
    sent = body;
    return Response.json({ content: [{ text: 'ok' }], usage: { input_tokens: 1600, output_tokens: 700 } });
  }, () => callAI({
    prompt: 'transcreva a página',
    maxTokens: 900,
    image: { base64: 'QUJD', mediaType: 'image/jpeg' },
  }));

  const mensagens = sent.messages as { role: string; content: unknown }[];
  assertEquals(mensagens[0].content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
    { type: 'text', text: 'transcreva a página' },
  ]);
});

Deno.test('callAI (anthropic): sem imagem, content continua sendo a string de sempre', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  let sent: Record<string, unknown> = {};
  await withFetch((_url, body) => {
    sent = body;
    return Response.json({ content: [{ text: 'ok' }] });
  }, () => callAI({ prompt: 'p', maxTokens: 10 }));

  const mensagens = sent.messages as { role: string; content: unknown }[];
  assertEquals(mensagens[0].content, 'p');
});

Deno.test('callAI (openai): imagem vira image_url com data URI, antes do texto', async () => {
  Deno.env.set('AI_PROVIDER', 'openai');
  Deno.env.set('AI_API_KEY', 'k');
  let sent: Record<string, unknown> = {};
  await withFetch((_url, body) => {
    sent = body;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  }, () => callAI({ prompt: 'p', maxTokens: 10, image: { base64: 'QUJD', mediaType: 'image/png' } }));

  const mensagens = sent.messages as { role: string; content: unknown }[];
  assertEquals(mensagens[0].content, [
    { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    { type: 'text', text: 'p' },
  ]);
});

// Falha fechada, item 4 dos critérios da BER-100: nunca silenciosamente.
Deno.test('callAI: provedor sem caminho de imagem recusa antes de chamar a rede', async () => {
  Deno.env.set('AI_PROVIDER', 'provedor-novo-sem-visao');
  Deno.env.set('AI_API_KEY', 'k');
  let chamou = false;
  await withFetch(() => {
    chamou = true;
    return Response.json({});
  }, () => assertRejects(
    () => callAI({ prompt: 'p', maxTokens: 10, image: { base64: 'QUJD', mediaType: 'image/jpeg' } }),
    AIImageUnsupportedError,
  ));
  assertEquals(chamou, false, 'a chamada não pode sair quando já se sabe que não funciona');
  Deno.env.set('AI_PROVIDER', 'anthropic');
});

Deno.test('callAI: media type fora da lista recusa antes de chamar a rede', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  await assertRejects(
    () => callAI({ prompt: 'p', maxTokens: 10, image: { base64: 'QUJD', mediaType: 'application/pdf' } }),
    AIImageUnsupportedError,
    'application/pdf',
  );
});

Deno.test('imageUnsupported: reconhece a recusa dos dois provedores, e só ela', () => {
  assertEquals(imageUnsupported(400, '{"error":{"message":"This model does not support image input"}}'), true);
  assertEquals(imageUnsupported(400, '{"error":{"message":"Image content blocks are not supported by this model"}}'), true);
  assertEquals(
    imageUnsupported(400, '{"error":{"message":"Invalid content type. image_url is only supported by certain models."}}'),
    true,
  );
  assertEquals(imageUnsupported(400, '{"error":{"message":"max_tokens is too large"}}'), false);
  assertEquals(imageUnsupported(500, 'does not support image'), false, 'erro do servidor não é problema de configuração');
});

Deno.test('callAI: modelo sem visão vira AIImageUnsupportedError, não AIHttpError', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  Deno.env.set('ANTHROPIC_MODEL', 'modelo-so-de-texto');
  try {
    await withFetch(
      () => new Response('{"error":{"message":"This model does not support image input"}}', { status: 400 }),
      () => assertRejects(
        () => callAI({ prompt: 'p', maxTokens: 10, image: { base64: 'QUJD', mediaType: 'image/jpeg' } }),
        AIImageUnsupportedError,
        'modelo-so-de-texto',
      ),
    );
  } finally {
    Deno.env.delete('ANTHROPIC_MODEL');
  }
});

Deno.test('callAI: a mesma mensagem numa chamada sem imagem continua sendo erro de HTTP', async () => {
  Deno.env.set('AI_PROVIDER', 'anthropic');
  Deno.env.set('ANTHROPIC_API_KEY', 'k');
  await withFetch(
    () => new Response('{"error":{"message":"This model does not support image input"}}', { status: 400 }),
    () => assertRejects(() => callAI({ prompt: 'p', maxTokens: 10 }), AIHttpError, 'Anthropic API error 400'),
  );
});
