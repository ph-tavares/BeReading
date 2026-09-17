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
}

/** Erro de API com o status HTTP, para a fila distinguir 429/5xx (transitório) do resto. */
export class AIHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function callAI(req: AIRequest): Promise<AIResult> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'openai';
  const sampling = req.temperature === undefined ? {} : { temperature: req.temperature };

  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      throw new AIHttpError(res.status, `Anthropic API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      model,
      usage: { inputTokens: toNumber(data.usage?.input_tokens), outputTokens: toNumber(data.usage?.output_tokens) },
    };
  }

  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  if (!apiKey) throw new Error('AI_API_KEY env var not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    throw new AIHttpError(res.status, `OpenAI API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model,
    usage: { inputTokens: toNumber(data.usage?.prompt_tokens), outputTokens: toNumber(data.usage?.completion_tokens) },
  };
}
