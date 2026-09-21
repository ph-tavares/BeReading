// supabase/functions/_shared/ai-claude-code.test.ts
// BER-59: testes do adaptador que roda a IA pelo Claude Code CLI no desenvolvimento local.
// O subprocess é dublado em todos eles — nenhum teste chama o `claude` de verdade.
import { assert, assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { AIOutOfCreditsError } from './ai.ts';
import { claudeCodeAI, type SpawnClaude, type SpawnResult } from './ai-claude-code.ts';
import { isTransientError, PermanentStepError } from './ingestion/queue.ts';

/**
 * Resposta real de `claude --print --output-format json`, capturada em 20/09/2026 nesta máquina
 * (claude 2.1.278) e reduzida aos campos que o adaptador lê. Os números de `usage` são os da
 * captura: servem para provar que o adaptador NÃO os repassa (ver o teste do usage zerado).
 */
const RESPOSTA_REAL: Record<string, unknown> = {
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '{"ok":true}',
  usage: { input_tokens: 2, output_tokens: 9, cache_creation_input_tokens: 22215, cache_read_input_tokens: 10118 },
  modelUsage: { 'claude-opus-5[1m]': { canonicalModel: 'claude-opus-5', inputTokens: 2, outputTokens: 9 } },
};

function spawnFake(over: Partial<SpawnResult> = {}, registro?: { args: string[]; stdin: string; timeoutMs?: number }[]): SpawnClaude {
  return (args, stdin, timeoutMs) => {
    registro?.push({ args, stdin, timeoutMs });
    return Promise.resolve({ code: 0, stdout: JSON.stringify(RESPOSTA_REAL), stderr: '', ...over });
  };
}

Deno.test('claudeCodeAI: devolve o texto do campo result e o modelo canônico', async () => {
  const ai = claudeCodeAI(spawnFake());

  const resultado = await ai({ prompt: 'oi', maxTokens: 100 });

  assertEquals(resultado.text, '{"ok":true}');
  assertEquals(resultado.model, 'claude-opus-5');
});

Deno.test('claudeCodeAI: o prompt vai por stdin, nunca nos argumentos (BER-59)', async () => {
  const chamadas: { args: string[]; stdin: string; timeoutMs?: number }[] = [];
  const ai = claudeCodeAI(spawnFake({}, chamadas));
  const prompt = 'Texto longo de um capítulo inteiro, que não caberia em linha de comando.';

  await ai({ prompt, maxTokens: 100 });

  assertEquals(chamadas.length, 1);
  assertEquals(chamadas[0].stdin, prompt);
  assertEquals(chamadas[0].args.some((a) => a.includes('capítulo')), false, 'prompt não pode ir por argv');
  assert(chamadas[0].args.includes('--print'));
  assertEquals(chamadas[0].args.join(' ').includes('--output-format json'), true);
});

Deno.test('claudeCodeAI: sobe o CLI sem ferramenta nenhuma — o prompt carrega texto de site não confiável (BER-59)', async () => {
  const chamadas: { args: string[]; stdin: string; timeoutMs?: number }[] = [];
  const ai = claudeCodeAI(spawnFake({}, chamadas));

  await ai({ prompt: 'texto extraído de uma página qualquer', maxTokens: 100 });

  // Sem isto, uma injeção escondida no texto da fonte poderia fazer o modelo usar Bash ou Read com
  // os privilégios de quem roda o script. O pipeline já delimita o texto como dado (spec §5.8), mas
  // delimitador é instrução — desligar a ferramenta é o que remove a capacidade.
  const args = chamadas[0].args;
  assert(args.includes('--restricted'), 'modo restrito: sem ferramentas que rodam comando ou código');
  assert(args.includes('--strict-mcp-config'), 'sem servidores MCP do ambiente do desenvolvedor');
  const i = args.indexOf('--tools');
  assert(i >= 0 && args[i + 1] === '', '--tools "" desliga todas as ferramentas embutidas');
});

Deno.test('claudeCodeAI: usage vai zerado de propósito, para não somar custo de assinatura ao teto do run', async () => {
  const ai = claudeCodeAI(spawnFake());

  const resultado = await ai({ prompt: 'oi', maxTokens: 100 });

  // A captura real traz 2/9 de turno e mais de 32 mil tokens de cache do harness do Claude Code.
  // Nada disso é custo de API do BeReading: o teto de US$ 3 por run mede a conta da Anthropic.
  assertEquals(resultado.usage, { inputTokens: 0, outputTokens: 0 });
});

Deno.test('claudeCodeAI: repassa o timeout do passo ao subprocess', async () => {
  const chamadas: { args: string[]; stdin: string; timeoutMs?: number }[] = [];
  const ai = claudeCodeAI(spawnFake({}, chamadas));

  await ai({ prompt: 'oi', maxTokens: 100, timeoutMs: 60_000 });

  assertEquals(chamadas[0].timeoutMs, 60_000);
});

Deno.test('claudeCodeAI: timeout local substitui o teto de 60 s que só existe por causa da Edge Function (BER-59)', async () => {
  const chamadas: { args: string[]; stdin: string; timeoutMs?: number }[] = [];
  const ai = claudeCodeAI(spawnFake({}, chamadas), { timeoutMs: 300_000 });

  // O passo pede 60 s (AI_STEP_TIMEOUT_MS, dimensionado para os 150 s de relógio da Edge Function).
  // Medido em 20/09/2026: uma extração pelo Claude Code passa disso e o subprocess morre com 143.
  await ai({ prompt: 'oi', maxTokens: 100, timeoutMs: 60_000 });

  assertEquals(chamadas[0].timeoutMs, 300_000);
});

Deno.test('claudeCodeAI: saída que não é JSON falha como permanente, sem devolver texto vazio', async () => {
  const ai = claudeCodeAI(spawnFake({ stdout: 'command not found' }));

  const err = await assertRejects(() => ai({ prompt: 'oi', maxTokens: 100 }));

  assert(err instanceof PermanentStepError, 'saída ilegível não melhora com retentativa');
  assertEquals(isTransientError(err), false);
});

Deno.test('claudeCodeAI: is_error do CLI vira falha, não resposta vazia', async () => {
  const ai = claudeCodeAI(spawnFake({
    stdout: JSON.stringify({ ...RESPOSTA_REAL, is_error: true, subtype: 'error_during_execution', result: '' }),
  }));

  const err = await assertRejects(() => ai({ prompt: 'oi', maxTokens: 100 }));

  assertStringIncludes((err as Error).message, 'error_during_execution');
});

Deno.test('claudeCodeAI: código de saída diferente de zero é transitório e entra na retentativa (BER-59)', async () => {
  const ai = claudeCodeAI(spawnFake({ code: 1, stdout: '', stderr: 'getaddrinfo ENOTFOUND api.anthropic.com' }));

  const err = await assertRejects(() => ai({ prompt: 'oi', maxTokens: 100 }));

  // Queda de rede passa; matar o passo na primeira falha perderia o run inteiro, que foi
  // exatamente o estrago do saldo esgotado na API (spec §11, item 41).
  assertEquals(isTransientError(err), true);
  assertStringIncludes((err as Error).message, 'ENOTFOUND');
});

Deno.test('claudeCodeAI: limite de uso da assinatura é pausa sem gastar tentativa, como saldo esgotado (BER-59)', async () => {
  // Run local de 21/09/2026: o limite estourou e o passo gastou 3 das 4 tentativas.
  const peloCodigo = claudeCodeAI(spawnFake({ code: 1, stdout: '', stderr: 'Claude AI usage limit reached|1790020800' }));
  const peloJson = claudeCodeAI(spawnFake({
    stdout: JSON.stringify({ ...RESPOSTA_REAL, is_error: true, api_error_status: 429, result: 'API Error: 429 rate_limit_error' }),
  }));

  for (const ai of [peloCodigo, peloJson]) {
    const err = await assertRejects(() => ai({ prompt: 'oi', maxTokens: 100 }));
    assert(err instanceof AIOutOfCreditsError, 'o worker só devolve a tentativa para AIOutOfCreditsError');
    assertStringIncludes((err as Error).message, 'limite de uso');
  }
});

Deno.test('claudeCodeAI: credencial expirada é pausa, não morte do passo (BER-59)', async () => {
  // Forma real da falha, capturada em 20/09/2026 com um CLAUDE_CODE_OAUTH_TOKEN inválido:
  // `is_error: true` com `subtype: "success"` (sic) e o status no `api_error_status`.
  const ai = claudeCodeAI(spawnFake({
    stdout: JSON.stringify({
      ...RESPOSTA_REAL,
      is_error: true,
      api_error_status: 401,
      result: 'Failed to authenticate. API Error: 401 OAuth access token is invalid.',
    }),
  }));

  const err = await assertRejects(() => ai({ prompt: 'oi', maxTokens: 100 }));

  // Mesma escolha do saldo esgotado na API (spec §11, item 41): devolver o passo à fila deixa o run
  // retomável depois de renovar a credencial, em vez de exigir refazer tudo.
  assertEquals(isTransientError(err), true);
  assertStringIncludes((err as Error).message, 'setup-token');
});

Deno.test('claudeCodeAI: resposta sem modelUsage ainda devolve texto, com modelo desconhecido', async () => {
  const semModelo = { ...RESPOSTA_REAL };
  delete semModelo.modelUsage;
  const ai = claudeCodeAI(spawnFake({ stdout: JSON.stringify(semModelo) }));

  const resultado = await ai({ prompt: 'oi', maxTokens: 100 });

  assertEquals(resultado.text, '{"ok":true}');
  assertEquals(resultado.model, 'claude-code');
});
