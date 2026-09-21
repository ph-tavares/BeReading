// supabase/functions/scripts/ai-bridge-local.ts
// BER-100: serve a IA do assistente de leitura pelo **Claude Code CLI**, para testar a foto da
// página na máquina do desenvolvedor sem consumir a conta de API.
//
//   cd supabase/functions
//   deno run --allow-net --allow-env --allow-run=claude --allow-read --allow-write \
//     scripts/ai-bridge-local.ts
//
// Runbook completo: `docs/assistente-local.md`.
//
// SÓ PARA USO LOCAL, como o `_shared/ai-claude-code.ts` da BER-59. Produção continua em `callAI`
// com a credencial de API; o Edge Runtime não abre subprocesso, então nada disto roda no servidor.
//
// **Por que isto é um servidor HTTP, e não um adaptador como o da ingestão.** O adaptador dela
// entra pelo `ai:` do `StepContext`, que existe porque os passos são um worker de fila e já
// tinham essa costura. O `scan-page` é um handler HTTP que o app chama: não tem ponto de injeção,
// e criar um só para desenvolvimento seria pôr caminho de teste dentro do caminho de produção.
// Esta ponte entra por fora, pelo `ANTHROPIC_BASE_URL` que o `_shared/ai.ts` já aceita desde a
// BER-59 — então **o `scan-page` roda exatamente como roda em produção** e não sabe que ela existe.
//
// Credencial: a do próprio Claude Code, como na ingestão. Na máquina do desenvolvedor, a sessão já
// logada; em máquina sem navegador, `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`) no
// ambiente do processo. Nada disso passa por este arquivo — quem autentica é o CLI.
import { LOCAL_AI_TIMEOUT_MS } from '../_shared/ai-claude-code.ts';

const PORT = Number(Deno.env.get('AI_BRIDGE_PORT') ?? '8788');

/**
 * Os mesmos argumentos do `ai-claude-code.ts`, com **uma diferença que precisa ser dita**.
 *
 * Lá o isolamento é `--tools ""`: nenhuma ferramenta, porque o prompt da ingestão carrega texto
 * raspado de sites que o BeReading não controla. Aqui a entrada é uma **imagem**, e o `--print` só
 * recebe texto no stdin — a única forma de a foto chegar ao modelo é ele abrir o arquivo com
 * `Read`. Então `Read` fica ligado, e é a única.
 *
 * A foto do leitor é entrada igualmente não confiável (spec §6.4), então o que sobra de proteção
 * importa: `--restricted` tira Bash, REPL e WebFetch e ignora settings de usuário/projeto/local;
 * `--strict-mcp-config` ignora os servidores MCP da máquina; e o `--add-dir` acrescentado por
 * chamada aponta para uma pasta temporária que contém **um arquivo**: a própria foto, apagada no
 * fim. Read não enxerga mais nada, nem este repositório.
 */
const ARGS_BASE = ['--print', '--output-format', 'json', '--restricted', '--strict-mcp-config'];

const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

interface BlocoImagem {
  type: 'image';
  source: { type: string; media_type: string; data: string };
}
interface BlocoTexto {
  type: 'text';
  text: string;
}
type Bloco = BlocoImagem | BlocoTexto;

interface SaidaCli {
  code: number;
  stdout: string;
  stderr: string;
}

/** Executa o CLI com `args`, escreve `stdin` na entrada e espera terminar. */
async function rodarClaude(args: string[], stdin: string, cwd?: string): Promise<SaidaCli> {
  const filho = new Deno.Command('claude', {
    args,
    cwd,
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT_MS),
  }).spawn();

  const writer = filho.stdin.getWriter();
  await writer.write(new TextEncoder().encode(stdin));
  await writer.close();

  const saida = await filho.output();
  // Decodifica os bytes de uma vez só. Decodificar pedaço a pedaço quebra um caractere acentuado
  // partido entre dois pedaços — medido em 20/09/2026: "o que é duplipensar" saiu como
  // "o que Ã© duplipensar" antes desta correção.
  return {
    code: saida.code,
    stdout: new TextDecoder().decode(saida.stdout),
    stderr: new TextDecoder().decode(saida.stderr),
  };
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Erro no formato que o `_shared/ai.ts` sabe ler, para o `scan-page` tratar como trataria a API. */
function erro(status: number, mensagem: string): Response {
  console.error(`  falhou: ${mensagem}`);
  return json({ error: { message: mensagem } }, status);
}

/**
 * A única linha que esta ponte acrescenta ao prompt do repositório. Em produção a foto é um bloco
 * de conteúdo e esta frase não existe — é a diferença que o runbook registra como "não prova".
 */
function instrucaoDaFoto(arquivo: string): string {
  return `A foto da página está no arquivo ${arquivo}. Abra esse arquivo com a ferramenta Read e responda a partir do que você vir nele.`;
}

/** Assinatura do executor, injetável para teste — mesmo recurso do `SpawnClaude` da BER-59. */
export type RodarCli = (args: string[], stdin: string, cwd?: string) => Promise<SaidaCli>;

/**
 * O que esta ponte faz fora de si mesma: chamar o CLI e mexer no disco.
 *
 * Injetável porque o `deno test` do CI roda com `--allow-net --allow-env` e mais nada — um teste
 * que gravasse de verdade reprovaria lá. Com isto, a suíte exercita o caminho real sem tocar no
 * disco, e quem quiser permissão de arquivo é só o script rodando de verdade.
 */
export interface PonteDeps {
  rodar: RodarCli;
  criarPasta: () => Promise<string>;
  gravar: (caminho: string, bytes: Uint8Array) => Promise<void>;
  apagar: (pasta: string) => Promise<void>;
}

const DEPS_REAIS: PonteDeps = {
  rodar: rodarClaude,
  criarPasta: () => Deno.makeTempDir({ prefix: 'bereading-foto-' }),
  gravar: (caminho, bytes) => Deno.writeFile(caminho, bytes),
  apagar: (pasta) => Deno.remove(pasta, { recursive: true }).catch(() => {}),
};

export async function atender(req: Request, deps: Partial<PonteDeps> = {}): Promise<Response> {
  const { rodar, criarPasta, gravar, apagar } = { ...DEPS_REAIS, ...deps };
  const url = new URL(req.url);
  if (req.method !== 'POST' || !url.pathname.startsWith('/v1/messages')) {
    return erro(404, 'esta ponte só responde POST /v1/messages');
  }

  let pedido: { messages?: { content?: Bloco[] | string }[]; model?: string };
  try {
    pedido = await req.json();
  } catch {
    return erro(400, 'corpo não era JSON');
  }

  const conteudo = pedido.messages?.[0]?.content;
  const blocos = Array.isArray(conteudo) ? conteudo : null;
  const imagem = blocos?.find((b): b is BlocoImagem => b.type === 'image') ?? null;
  const prompt = blocos
    ? (blocos.find((b): b is BlocoTexto => b.type === 'text')?.text ?? '')
    : String(conteudo ?? '');

  console.log(`\n--- chamada ${new Date().toLocaleTimeString('pt-BR')} ---`);
  console.log(`blocos: ${blocos ? blocos.map((b) => b.type).join(' -> ') : 'texto puro'}`);

  let pasta: string | null = null;
  let stdin = prompt;
  const args = [...ARGS_BASE];

  try {
    if (imagem) {
      const tipo = imagem.source?.media_type ?? 'image/jpeg';
      const bytes = Uint8Array.from(atob(imagem.source?.data ?? ''), (c) => c.charCodeAt(0));
      console.log(`imagem: ${tipo}, ${(bytes.length / 1024).toFixed(0)} KB`);

      // Pasta descartável com a foto dentro e mais nada: é o único lugar que o Read enxerga, e
      // some no `finally`. A imagem não fica gravada aqui também, como manda a regra do produto.
      pasta = await criarPasta();
      const arquivo = `${pasta}/pagina.${EXTENSAO[tipo] ?? 'jpg'}`;
      await gravar(arquivo, bytes);

      args.push('--allowedTools', 'Read', '--add-dir', pasta);
      stdin = `${instrucaoDaFoto(arquivo)}\n\n${prompt}`;
    }

    console.log(`prompt: ${stdin.length} caracteres`);
    const saida = await rodar(args, stdin, pasta ?? undefined);

    if (saida.code !== 0) {
      const motivo = saida.stderr.trim() || saida.stdout.trim() || 'sem saída';
      return erro(503, `claude CLI saiu com código ${saida.code}: ${motivo.slice(0, 300)}`);
    }

    let dados: Record<string, unknown>;
    try {
      dados = JSON.parse(saida.stdout);
    } catch {
      return erro(500, `claude CLI não devolveu JSON: ${saida.stdout.slice(0, 200)}`);
    }

    const statusApi = dados.api_error_status;
    if (statusApi === 401 || statusApi === 403) {
      return erro(503, `credencial do Claude Code inválida ou expirada (HTTP ${statusApi}): renove com \`claude setup-token\``);
    }
    if (dados.is_error === true || dados.subtype !== 'success') {
      return erro(500, `claude CLI falhou (${String(dados.subtype ?? 'sem subtype')}): ${String(dados.result ?? '').slice(0, 200)}`);
    }

    const uso = dados.modelUsage as Record<string, unknown> | undefined;
    const modelo = Object.keys(uso ?? {})[0] ?? 'claude-code';
    console.log(`modelo: ${modelo} | ${String(dados.duration_api_ms ?? '?')} ms`);

    return json({
      content: [{ type: 'text', text: dados.result ?? '' }],
      // Zerado de propósito, pelo mesmo motivo do `ai-claude-code.ts`: os números do CLI são
      // dominados pelo system prompt do próprio harness e não são a fatura da API. Gravá-los em
      // `assistant_messages` faria o custo por interação mentir.
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  } catch (err) {
    return erro(500, `ponte quebrou: ${err}`);
  } finally {
    if (pasta) await apagar(pasta);
  }
}

if (import.meta.main) {
  console.log(`Ponte do Claude Code ouvindo em http://127.0.0.1:${PORT}`);
  console.log('Aponte ANTHROPIC_BASE_URL para ela e o scan-page não vai saber a diferença.');
  console.log('Quem autentica é o CLI: nenhuma chave passa por aqui.\n');
  // Envolvido de propósito: o `Deno.serve` passa um segundo argumento (dados da conexão) que
  // cairia no parâmetro injetável do executor.
  Deno.serve({ port: PORT }, (req) => atender(req));
}
