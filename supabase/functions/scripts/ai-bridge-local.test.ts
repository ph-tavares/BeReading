// supabase/functions/scripts/ai-bridge-local.test.ts
// BER-100: a ponte que serve a IA do assistente pelo Claude Code CLI no desenvolvimento.
//
// O CLI e o disco são injetados (mesmo recurso do `SpawnClaude` da BER-59), então estes testes não
// abrem subprocesso nem gravam arquivo: rodam com as permissões que o CI dá à suíte
// (`--allow-net --allow-env`) e exercitam o `atender` de verdade, não uma cópia.
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { atender, type PonteDeps } from './ai-bridge-local.ts';

const RESPOSTA_OK = JSON.stringify({
  is_book_page: true,
  page_text: 'Quem controla o passado controla o futuro.',
  suggestions: ['o que é duplipensar'],
  detected_page: 220,
});

function saidaDoCli(result: string, extra: Record<string, unknown> = {}) {
  return {
    code: 0,
    stdout: JSON.stringify({
      result,
      subtype: 'success',
      is_error: false,
      api_error_status: null,
      modelUsage: { 'claude-sonnet-5': { canonicalModel: 'claude-sonnet-5' } },
      ...extra,
    }),
    stderr: '',
  };
}

/** Uma imagem de 1 pixel: `QUJD` em base64 são os bytes `A`, `B`, `C`. */
const FOTO_BASE64 = 'QUJD';
const FOTO_BYTES = [65, 66, 67];

/** Disco de mentira, que anota o que teria acontecido. */
function discoFalso() {
  const gravados: { caminho: string; bytes: number[] }[] = [];
  const apagados: string[] = [];
  return {
    gravados,
    apagados,
    deps: {
      criarPasta: () => Promise.resolve('/tmp/pasta-de-teste'),
      gravar: (caminho: string, bytes: Uint8Array) => {
        gravados.push({ caminho, bytes: [...bytes] });
        return Promise.resolve();
      },
      apagar: (pasta: string) => {
        apagados.push(pasta);
        return Promise.resolve();
      },
    } satisfies Omit<PonteDeps, 'rodar'>,
  };
}

function pedido(corpo: unknown): Request {
  return new Request('http://localhost:8788/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

function comImagem(prompt = 'transcreva a página') {
  return pedido({
    model: 'claude-haiku-4-5',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: FOTO_BASE64 } },
        { type: 'text', text: prompt },
      ],
    }],
  });
}

Deno.test('ponte: a foto vira arquivo, e o Read enxerga só a pasta dela', async () => {
  const disco = discoFalso();
  let argsVistos: string[] = [];
  let stdinVisto = '';
  let cwdVisto: string | undefined;

  const res = await atender(comImagem(), {
    ...disco.deps,
    rodar: (args, stdin, cwd) => {
      argsVistos = args;
      stdinVisto = stdin;
      cwdVisto = cwd;
      return Promise.resolve(saidaDoCli(RESPOSTA_OK));
    },
  });

  assertEquals(res.status, 200);

  // A foto foi decodificada e gravada dentro da pasta descartável, com o nome que o prompt cita.
  assertEquals(disco.gravados, [{ caminho: '/tmp/pasta-de-teste/pagina.png', bytes: FOTO_BYTES }]);

  // Read é a única ferramenta, e o diretório liberado é o da foto — nada além dela.
  assertEquals(argsVistos.includes('--restricted'), true);
  assertEquals(argsVistos.includes('--strict-mcp-config'), true);
  assertEquals(argsVistos[argsVistos.indexOf('--allowedTools') + 1], 'Read');
  assertEquals(argsVistos[argsVistos.indexOf('--add-dir') + 1], '/tmp/pasta-de-teste');
  assertEquals(cwdVisto, '/tmp/pasta-de-teste');

  // O prompt do repositório continua inteiro; a ponte só acrescenta a linha da foto na frente.
  assertStringIncludes(stdinVisto, 'ferramenta Read');
  assertStringIncludes(stdinVisto, 'transcreva a página');

  // E a foto não fica para trás.
  assertEquals(disco.apagados, ['/tmp/pasta-de-teste']);
});

Deno.test('ponte: chamada sem imagem não liga ferramenta nem toca no disco', async () => {
  const disco = discoFalso();
  let argsVistos: string[] = [];

  const res = await atender(pedido({ messages: [{ role: 'user', content: 'só texto' }] }), {
    ...disco.deps,
    rodar: (args) => {
      argsVistos = args;
      return Promise.resolve(saidaDoCli('resposta em texto'));
    },
  });

  assertEquals(res.status, 200);
  assertEquals(argsVistos.includes('--allowedTools'), false);
  assertEquals(argsVistos.includes('--add-dir'), false);
  assertEquals(disco.gravados, []);
});

Deno.test('ponte: devolve no formato da Anthropic, com usage zerado de propósito', async () => {
  const disco = discoFalso();
  const res = await atender(comImagem(), {
    ...disco.deps,
    rodar: () => Promise.resolve(saidaDoCli(RESPOSTA_OK)),
  });
  const corpo = await res.json();

  assertEquals(corpo.content[0].type, 'text');
  assertEquals(corpo.content[0].text, RESPOSTA_OK);
  // Os números do CLI são do harness, não da fatura da API (mesma decisão do ai-claude-code.ts).
  assertEquals(corpo.usage, { input_tokens: 0, output_tokens: 0 });
});

Deno.test('ponte: credencial vencida vira 503 com a instrução de renovar', async () => {
  const disco = discoFalso();
  const res = await atender(comImagem(), {
    ...disco.deps,
    rodar: () => Promise.resolve({
      code: 0,
      stdout: JSON.stringify({ is_error: true, subtype: 'success', api_error_status: 401, result: '' }),
      stderr: '',
    }),
  });

  assertEquals(res.status, 503);
  assertStringIncludes((await res.json()).error.message, 'claude setup-token');
  // Mesmo na falha, a foto sai do disco.
  assertEquals(disco.apagados, ['/tmp/pasta-de-teste']);
});

Deno.test('ponte: CLI que falha ou não devolve JSON não vira resposta boa', async () => {
  const disco = discoFalso();

  const saiuMal = await atender(comImagem(), {
    ...disco.deps,
    rodar: () => Promise.resolve({ code: 1, stdout: '', stderr: 'binário não encontrado' }),
  });
  assertEquals(saiuMal.status, 503);

  const semJson = await atender(comImagem(), {
    ...disco.deps,
    rodar: () => Promise.resolve({ code: 0, stdout: 'não sou JSON', stderr: '' }),
  });
  assertEquals(semJson.status, 500);
});

Deno.test('ponte: só responde POST /v1/messages', async () => {
  const outraRota = await atender(new Request('http://localhost:8788/v1/models', { method: 'POST' }));
  assertEquals(outraRota.status, 404);

  const get = await atender(new Request('http://localhost:8788/v1/messages'));
  assertEquals(get.status, 404);
});
