// supabase/functions/_shared/ai-claude-code.ts
// BER-59: roda a IA da ingestão pelo **Claude Code CLI**, para desenvolver o pipeline na máquina
// do desenvolvedor sem consumir a conta de API. Satisfaz o mesmo contrato de `callAI` (ai.ts), de
// modo que os passos não sabem qual dos dois está por baixo.
//
// SÓ PARA USO LOCAL. Nenhuma Edge Function importa este arquivo: o Edge Runtime não abre
// subprocesso, e produção continua em `callAI` com a credencial de API (ai.ts). O ponto de troca é
// o `ai:` do contexto — `production-context.ts` segue intocado.
//
// Credencial: a do próprio Claude Code. Na máquina do desenvolvedor, a sessão já logada; em
// ambiente sem navegador, `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`) no ambiente do
// processo — o mesmo mecanismo que o agente do Schools Out usa. Nada disso passa por este arquivo:
// quem autentica é o CLI.
import { type AIRequest, AIOutOfCreditsError, type AIResult } from './ai.ts';
import { HttpStatusError, PermanentStepError } from './ingestion/queue.ts';

export interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Executa o CLI com `args`, escreve `stdin` na entrada e espera terminar. Injetável para teste. */
export type SpawnClaude = (args: string[], stdin: string, timeoutMs?: number) => Promise<SpawnResult>;

/**
 * `--print` responde e sai (sem sessão interativa); `--output-format json` traz o texto em `result`
 * mais o `modelUsage`. O prompt NUNCA vai aqui: um bloco de extração tem milhares de caracteres e
 * estouraria o limite de argumentos do sistema — vai por stdin.
 *
 * ISOLAMENTO (achado do crítico cross-model, 20/09/2026). O prompt carrega texto raspado de sites
 * que o BeReading não controla — inclusive fontes rejeitadas depois, por política. Se o modelo
 * obedecesse a uma instrução escondida nesse texto, faria isso com as ferramentas e os privilégios
 * de quem roda o script. O pipeline já trata o texto como dado delimitado (spec §5.8), mas
 * delimitador é instrução: só desligar a ferramenta remove a capacidade.
 *   --tools ""            desliga todas as ferramentas embutidas (é tradução de texto, não agente);
 *   --restricted          tira Bash/REPL/WebFetch e ignora settings de usuário/projeto/local;
 *   --strict-mcp-config   ignora os servidores MCP configurados na máquina.
 */
const ARGS = ['--print', '--output-format', 'json', '--tools', '', '--restricted', '--strict-mcp-config'];

/** Nome usado quando a resposta não diz qual modelo respondeu. */
const MODELO_DESCONHECIDO = 'claude-code';

/**
 * Teto de uma chamada no desenvolvimento local: 5 min. Medido em 20/09/2026, uma extração pelo
 * Claude Code leva de 20 s a mais de 60 s — o teto de produção (60 s) mataria o subprocesso no meio.
 */
export const LOCAL_AI_TIMEOUT_MS = 300_000;

function modeloDe(data: Record<string, unknown>): string {
  const uso = data.modelUsage;
  if (uso === null || typeof uso !== 'object') return MODELO_DESCONHECIDO;
  const [chave, valor] = Object.entries(uso as Record<string, unknown>)[0] ?? [];
  if (chave === undefined) return MODELO_DESCONHECIDO;
  const canonico = (valor as { canonicalModel?: unknown } | null)?.canonicalModel;
  return typeof canonico === 'string' ? canonico : chave;
}

export interface ClaudeCodeOptions {
  /**
   * Substitui o timeout que o passo pede. Os passos usam `AI_STEP_TIMEOUT_MS` (60 s), dimensionado
   * para caber nos 150 s de relógio da Edge Function — um teto que não existe na máquina do
   * desenvolvedor. Medido em 20/09/2026: uma extração pelo Claude Code passa de 60 s e o
   * subprocesso morre com SIGTERM (código 143), devolvendo o passo à fila sem necessidade.
   */
  timeoutMs?: number;
}

/**
 * Limite de uso da assinatura do Claude Code (BER-59, run local de 21/09/2026). Quando estourou, o
 * CLI saiu com `api_error` e o passo gastou 3 das 4 tentativas. Não é defeito do passo: é pausa até
 * o limite reiniciar, a mesma situação do saldo esgotado na API (spec §11, item 41).
 */
const USAGE_LIMIT = /usage limit|limit reached|rate[_ ]?limit|resets? (?:at|in)/i;

export function claudeCodeAI(spawn: SpawnClaude = spawnClaudeCli, options: ClaudeCodeOptions = {}): (req: AIRequest) => Promise<AIResult> {
  return async (req: AIRequest): Promise<AIResult> => {
    const res = await spawn(ARGS, req.prompt, options.timeoutMs ?? req.timeoutMs);

    if (res.code !== 0) {
      // Transitório de propósito (status >= 500 em `isTransientError`): limite de uso da assinatura
      // e queda de rede aparecem assim, e matar o passo na primeira falha jogaria fora o run
      // inteiro — o estrago que o saldo esgotado causou na API (spec §11, item 41).
      const motivo = res.stderr.trim() || res.stdout.trim() || 'sem saída';
      if (USAGE_LIMIT.test(motivo)) throw new AIOutOfCreditsError(`Claude Code: limite de uso da assinatura (${motivo.slice(0, 120)})`);
      throw new HttpStatusError(503, `claude CLI saiu com código ${res.code}: ${motivo}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(res.stdout);
    } catch {
      // Binário ausente, saída de erro em texto puro, versão sem `--output-format json`: nada
      // disso melhora tentando de novo.
      throw new PermanentStepError(`claude CLI não devolveu JSON: ${res.stdout.slice(0, 200)}`);
    }

    // Credencial inválida ou vencida. Capturado em 20/09/2026: vem como `is_error: true` com
    // `subtype: "success"` e o status em `api_error_status`. Transitório de propósito — o passo
    // volta à fila e o run retoma depois da renovação, em vez de morrer (spec §11, item 41).
    const statusApi = data.api_error_status;
    if (statusApi === 401 || statusApi === 403) {
      throw new HttpStatusError(503, `credencial do Claude Code inválida ou expirada (HTTP ${statusApi}): renove com \`claude setup-token\` e exporte CLAUDE_CODE_OAUTH_TOKEN`);
    }

    if (statusApi === 429 || (data.is_error === true && USAGE_LIMIT.test(String(data.result ?? '')))) {
      throw new AIOutOfCreditsError(`Claude Code: limite de uso da assinatura (${String(data.result ?? '').slice(0, 120)})`);
    }

    if (data.is_error === true || data.subtype !== 'success') {
      throw new PermanentStepError(`claude CLI falhou (${String(data.subtype ?? 'sem subtype')}): ${String(data.result ?? '').slice(0, 200)}`);
    }

    return {
      text: typeof data.result === 'string' ? data.result : '',
      model: modeloDe(data),
      // Zerado de propósito. O `usage` alimenta o teto de custo do run (budget.ts), que mede a
      // fatura da API da Anthropic. Por aqui não existe essa fatura, e os números do CLI são
      // dominados pelo system prompt do próprio harness (medido em 20/09/2026: ~32 mil tokens de
      // cache numa pergunta de 3 palavras). Somá-los faria o run local fechar `partial` por um
      // custo que produção não teria. O consumo de assinatura é reportado pelo runner, separado.
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  };
}

/** Implementação real. Exige `--allow-run=claude`; só o runner local usa. */
async function spawnClaudeCli(args: string[], stdin: string, timeoutMs?: number): Promise<SpawnResult> {
  const child = new Deno.Command('claude', {
    args,
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
    signal: timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
  }).spawn();

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(stdin));
  await writer.close();

  const saida = await child.output();
  return {
    code: saida.code,
    stdout: new TextDecoder().decode(saida.stdout),
    stderr: new TextDecoder().decode(saida.stderr),
  };
}
