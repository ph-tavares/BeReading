// supabase/functions/_shared/ai.ts
// Provedor de IA único. generate-questions e evaluate-answer tinham cópias quase
// iguais de `callAI`; a ingestão (BER-59) precisa da mesma chamada e também do
// `usage`, porque o custo de cada run é medido pelos tokens reais, não estimado.
//
// Env: AI_PROVIDER (openai|anthropic)
//   OpenAI    -> AI_API_KEY, AI_MODEL (default gpt-4o-mini)
//   Anthropic -> ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-haiku-4-5)

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResult {
  text: string;
  model: string;
  usage: AIUsage;
}

export interface AIRequest {
  prompt: string;
  maxTokens: number;
  temperature?: number;
  /**
   * Aborta a chamada depois disto (BER-59). O worker da ingestão roda dentro do relógio de
   * 150 s da Edge Function: uma resposta pendurada mataria o worker no meio do passo. Sem
   * valor, nada muda para generate-questions e evaluate-answer.
   */
  timeoutMs?: number;
}

/** Erro de API com o status HTTP, para a fila distinguir 429/5xx (transitório) do resto. */
export class AIHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Saldo acabou na conta do provedor (BER-59). Não é erro do passo nem defeito do conteúdo: é uma
 * pausa administrativa. A Anthropic devolve 400 com "credit balance is too low" e a OpenAI, 429
 * com "insufficient_quota" — tratados como falha, derrubariam o run inteiro e obrigariam a refazer
 * tudo depois da recarga. Aconteceu no quinto teste do 1984.
 */
export class AIOutOfCreditsError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const OUT_OF_CREDITS = /credit balance is too low|insufficient_quota|billing_hard_limit|exceeded your current quota/i;

/** Erro de saldo, olhando status e corpo da resposta do provedor. */
export function outOfCredits(status: number, body: string): boolean {
  return (status === 400 || status === 402 || status === 429) && OUT_OF_CREDITS.test(body);
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Credencial de um provedor. A de reserva (BER-59, spec §11 item 42) entra só quando a principal
 * acusa saldo esgotado: `baseUrl` permite apontar para outra conta, um gateway ou uma nuvem.
 */
export interface AICredential {
  apiKey: string;
  baseUrl: string;
  model: string;
  label: string;
}

function credential(provider: string, reserva: boolean): AICredential | null {
  const sufixo = reserva ? '_FALLBACK' : '';
  const label = reserva ? 'reserva' : 'principal';
  if (provider === 'anthropic') {
    const apiKey = Deno.env.get(`ANTHROPIC${sufixo}_API_KEY`);
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: Deno.env.get(`ANTHROPIC${sufixo}_BASE_URL`) ?? 'https://api.anthropic.com',
      model: Deno.env.get(`ANTHROPIC${sufixo}_MODEL`) ?? Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5',
      label,
    };
  }
  const apiKey = Deno.env.get(`AI${sufixo}_API_KEY`);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: Deno.env.get(`AI${sufixo}_BASE_URL`) ?? 'https://api.openai.com',
    model: Deno.env.get(`AI${sufixo}_MODEL`) ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini',
    label,
  };
}

export async function callAI(req: AIRequest): Promise<AIResult> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'openai';
  const principal = credential(provider, false);
  if (!principal) throw new Error(provider === 'anthropic' ? 'ANTHROPIC_API_KEY env var not set' : 'AI_API_KEY env var not set');

  try {
    return await callWith(provider, principal, req);
  } catch (err) {
    // Saldo esgotado na principal: tenta a de reserva antes de pausar o run (spec §11, item 42).
    const reserva = err instanceof AIOutOfCreditsError ? credential(provider, true) : null;
    if (!reserva) throw err;
    return await callWith(provider, reserva, req);
  }
}

async function callWith(provider: string, cred: AICredential, req: AIRequest): Promise<AIResult> {
  const sampling = req.temperature === undefined ? {} : { temperature: req.temperature };
  const abort = req.timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(req.timeoutMs) };

  if (provider === 'anthropic') {
    const { apiKey, model } = cred;

    const res = await fetch(`${cred.baseUrl}/v1/messages`, {
      ...abort,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        ...sampling,
        messages: [{ role: 'user', content: req.prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (outOfCredits(res.status, body)) throw new AIOutOfCreditsError(`Anthropic (${cred.label}): saldo insuficiente`);
      throw new AIHttpError(res.status, `Anthropic API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      model,
      usage: { inputTokens: toNumber(data.usage?.input_tokens), outputTokens: toNumber(data.usage?.output_tokens) },
    };
  }

  const { apiKey, model } = cred;

  const res = await fetch(`${cred.baseUrl}/v1/chat/completions`, {
    ...abort,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      ...sampling,
      messages: [{ role: 'user', content: req.prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (outOfCredits(res.status, body)) throw new AIOutOfCreditsError(`OpenAI (${cred.label}): saldo insuficiente`);
    throw new AIHttpError(res.status, `OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model,
    usage: { inputTokens: toNumber(data.usage?.prompt_tokens), outputTokens: toNumber(data.usage?.completion_tokens) },
  };
}
