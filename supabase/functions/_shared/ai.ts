// supabase/functions/_shared/ai.ts
// Provedor de IA único. generate-questions e evaluate-answer tinham cópias quase
// iguais de `callAI`; a ingestão (BER-59) precisa da mesma chamada e também do
// `usage`, porque o custo de cada run é medido pelos tokens reais, não estimado.
// O assistente de leitura (BER-100) trouxe a imagem: ver `AIRequest.image`.
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

/**
 * A foto da página que o leitor tirou (BER-100). Só o `scan-page` usa; a imagem viaja em
 * memória e não é gravada em lugar nenhum — nem em tabela, nem em Storage (spec §4.1).
 */
export interface AIImage {
  /** O conteúdo em base64, **sem** o prefixo `data:` — quem monta o data URI é o caminho OpenAI. */
  base64: string;
  /** `image/jpeg`, `image/png`, `image/webp` ou `image/gif`. Outro valor falha fechado. */
  mediaType: string;
}

/** Os media types que os dois provedores aceitam. Fora desta lista, a chamada nem sai. */
const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Provedores para os quais este módulo sabe montar um bloco de imagem. */
const IMAGE_PROVIDERS = ['anthropic', 'openai'];

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
  /**
   * Imagem que acompanha o prompt (BER-100). Sem ela, `content` continua sendo a string de
   * sempre e nada muda para quem já chamava este módulo.
   *
   * O bloco da imagem vai **antes** do texto nos dois provedores: é a ordem que a Anthropic
   * recomenda e a que faz o prompt se referir a uma imagem que o modelo já viu.
   */
  image?: AIImage;
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

/**
 * O caminho configurado não aceita imagem (BER-100). Existe para o `scan-page` **falhar
 * fechado**: sem este erro, um provedor sem visão viraria ou um 500 genérico ou, pior, uma
 * resposta escrita sem olhar a foto. Ausência de suporte nunca pode virar comportamento
 * silencioso (`AGENTS.md` §3.8, o mesmo princípio do `BILLING_MODE` da BER-85).
 */
export class AIImageUnsupportedError extends Error {
  constructor(readonly provider: string, motivo: string) {
    super(`O provedor de IA configurado (${provider}) não aceita imagem: ${motivo}`);
  }
}

const IMAGE_UNSUPPORTED =
  /image_url is only supported|do(?:es)? not support image|image[s]?(?: content block[s]?)? (?:is|are) not supported|invalid.*image.*not supported/i;

/**
 * A recusa veio do próprio provedor: a chave e o saldo estão bons, mas o **modelo** não tem
 * visão. Acontece com `ANTHROPIC_MODEL` ou `AI_MODEL` apontando para um modelo só de texto —
 * dá para configurar e o erro só aparece na primeira foto.
 */
export function imageUnsupported(status: number, body: string): boolean {
  return (status === 400 || status === 415 || status === 422) && IMAGE_UNSUPPORTED.test(body);
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
  /**
   * Cabeçalho que leva a credencial. Padrão `x-api-key` (chave de API da Anthropic); `Authorization`
   * com prefixo `Bearer ` atende gateway corporativo, proxy e nuvem. Configurável por secret para o
   * time apontar a reserva para onde decidir, sem mudar código (BER-59, spec §11 item 42).
   */
  authHeader: string;
}

function authHeaderFor(cred: Pick<AICredential, 'apiKey' | 'authHeader'>): Record<string, string> {
  const nome = cred.authHeader;
  const valor = /^authorization$/i.test(nome) && !/^bearer /i.test(cred.apiKey) ? `Bearer ${cred.apiKey}` : cred.apiKey;
  return { [nome]: valor };
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
      authHeader: Deno.env.get(`ANTHROPIC${sufixo}_AUTH_HEADER`) ?? 'x-api-key',
    };
  }
  const apiKey = Deno.env.get(`AI${sufixo}_API_KEY`);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: Deno.env.get(`AI${sufixo}_BASE_URL`) ?? 'https://api.openai.com',
    model: Deno.env.get(`AI${sufixo}_MODEL`) ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini',
    label,
    authHeader: Deno.env.get(`AI${sufixo}_AUTH_HEADER`) ?? 'Authorization',
  };
}

/**
 * Recusa a chamada com imagem **antes** de gastar rede, quando já dá para saber que ela não vai
 * funcionar. Um `AI_PROVIDER` desconhecido cai no caminho da OpenAI para texto, e continua caindo —
 * mas mandar uma foto por um caminho que ninguém verificou é o tipo de silêncio que a BER-85
 * proibiu. Aqui ele vira erro.
 */
function assertImageSupported(provider: string, image: AIImage): void {
  if (!IMAGE_PROVIDERS.includes(provider)) {
    throw new AIImageUnsupportedError(provider, 'não há caminho de imagem escrito para este provedor');
  }
  if (!IMAGE_MEDIA_TYPES.includes(image.mediaType)) {
    throw new AIImageUnsupportedError(
      provider,
      `media type "${image.mediaType}" fora da lista aceita (${IMAGE_MEDIA_TYPES.join(', ')})`,
    );
  }
}

export async function callAI(req: AIRequest): Promise<AIResult> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'openai';
  if (req.image) assertImageSupported(provider, req.image);
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

/**
 * O `content` da mensagem do leitor. Sem imagem continua sendo a string de sempre — mudar isso
 * mexeria no prompt de quem já usa o módulo. Com imagem, vira lista de blocos, e a imagem vem
 * antes do texto.
 */
function anthropicContent(req: AIRequest): unknown {
  if (!req.image) return req.prompt;
  return [
    { type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.base64 } },
    { type: 'text', text: req.prompt },
  ];
}

/** O equivalente da OpenAI: `image_url` com a imagem embutida num data URI. */
function openaiContent(req: AIRequest): unknown {
  if (!req.image) return req.prompt;
  return [
    { type: 'image_url', image_url: { url: `data:${req.image.mediaType};base64,${req.image.base64}` } },
    { type: 'text', text: req.prompt },
  ];
}

async function callWith(provider: string, cred: AICredential, req: AIRequest): Promise<AIResult> {
  const sampling = req.temperature === undefined ? {} : { temperature: req.temperature };
  const abort = req.timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(req.timeoutMs) };

  if (provider === 'anthropic') {
    const { model } = cred;

    const res = await fetch(`${cred.baseUrl}/v1/messages`, {
      ...abort,
      method: 'POST',
      headers: {
        ...authHeaderFor(cred),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        ...sampling,
        messages: [{ role: 'user', content: anthropicContent(req) }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (outOfCredits(res.status, body)) throw new AIOutOfCreditsError(`Anthropic (${cred.label}): saldo insuficiente`);
      if (req.image && imageUnsupported(res.status, body)) {
        throw new AIImageUnsupportedError(provider, `o modelo ${model} recusou a imagem`);
      }
      throw new AIHttpError(res.status, `Anthropic API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      model,
      usage: { inputTokens: toNumber(data.usage?.input_tokens), outputTokens: toNumber(data.usage?.output_tokens) },
    };
  }

  const { model } = cred;

  const res = await fetch(`${cred.baseUrl}/v1/chat/completions`, {
    ...abort,
    method: 'POST',
    headers: { ...authHeaderFor(cred), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      ...sampling,
      messages: [{ role: 'user', content: openaiContent(req) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (outOfCredits(res.status, body)) throw new AIOutOfCreditsError(`OpenAI (${cred.label}): saldo insuficiente`);
    if (req.image && imageUnsupported(res.status, body)) {
      throw new AIImageUnsupportedError(provider, `o modelo ${model} recusou a imagem`);
    }
    throw new AIHttpError(res.status, `OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    model,
    usage: { inputTokens: toNumber(data.usage?.prompt_tokens), outputTokens: toNumber(data.usage?.completion_tokens) },
  };
}
