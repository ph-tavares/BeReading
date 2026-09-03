// supabase/functions/_shared/ai-json.ts
// Leitura da resposta do LLM: extração do JSON e validação do conteúdo.
//
// BER-37: o parsing usava regex NÃO-gulosa (`/\[[\s\S]*?\]/`), que para no primeiro
// `]` ou `}` encontrado. Basta a IA escrever "o que ele sente [medo] ao ver..." para
// o JSON ser cortado no meio e a leitura estourar.
//
// BER-38: `q.type` ia cru para o `insert`. O CHECK do banco só aceita
// `comprehension|reflection`, então UM valor inesperado derrubava o lote inteiro —
// as 4 perguntas perdidas e o capítulo marcado como `failed`.

export type QuestionType = 'comprehension' | 'reflection';

export interface ParsedQuestion {
  type: QuestionType;
  question_text: string;
}

export interface ParseResult<T> {
  valid: T[];
  /** Itens descartados por não passarem na validação, com o motivo. */
  rejected: { item: unknown; reason: string }[];
}

/**
 * Extrai o JSON de uma resposta de LLM.
 *
 * Ordem: tenta a resposta inteira; remove cerca de markdown; e só então recorta do
 * primeiro delimitador de abertura até o **último** de fechamento (guloso) — nunca
 * até o primeiro, que é o que trunca texto contendo `]` ou `}`.
 */
export function extractJson(raw: string, kind: 'array' | 'object'): unknown {
  const open = kind === 'array' ? '[' : '{';
  const close = kind === 'array' ? ']' : '}';

  const trimmed = raw.trim();

  // Fontes possíveis: a resposta inteira e, se houver, o interior da cerca markdown.
  const sources = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) sources.push(fenced[1].trim());

  // De cada fonte, tentamos o texto inteiro e o recorte guloso
  // (primeiro delimitador de abertura até o ÚLTIMO de fechamento).
  const candidates: string[] = [];
  for (const source of sources) {
    candidates.push(source);
    const start = source.indexOf(open);
    const end = source.lastIndexOf(close);
    if (start !== -1 && end > start) {
      candidates.push(source.slice(start, end + 1));
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const matchesKind = kind === 'array' ? Array.isArray(parsed) : isPlainObject(parsed);
      if (matchesKind) return parsed;
    } catch {
      // tenta o próximo candidato
    }
  }

  throw new Error(`No valid JSON ${kind} found in LLM response`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const QUESTION_TYPES: QuestionType[] = ['comprehension', 'reflection'];

/**
 * Lê o lote de perguntas, descartando **só** as inválidas.
 *
 * Uma pergunta com `type` fora do domínio não pode derrubar as outras três: o
 * capítulo com 3 perguntas boas é melhor que o capítulo marcado como falho.
 */
export function parseQuestions(raw: string): ParseResult<ParsedQuestion> {
  const parsed = extractJson(raw, 'array') as unknown[];
  const valid: ParsedQuestion[] = [];
  const rejected: { item: unknown; reason: string }[] = [];

  for (const item of parsed) {
    if (!isPlainObject(item)) {
      rejected.push({ item, reason: 'não é um objeto' });
      continue;
    }

    const text = typeof item.question_text === 'string' ? item.question_text.trim() : '';
    if (!text) {
      rejected.push({ item, reason: 'question_text vazio ou ausente' });
      continue;
    }

    const rawType = typeof item.type === 'string' ? item.type.trim().toLowerCase() : '';
    if (!QUESTION_TYPES.includes(rawType as QuestionType)) {
      rejected.push({ item, reason: `type inválido: ${JSON.stringify(item.type)}` });
      continue;
    }

    valid.push({ type: rawType as QuestionType, question_text: text });
  }

  return { valid, rejected };
}

export interface ParsedEvaluation {
  /** `null` = a IA não conseguiu avaliar. Não é zero — ver BER-42. */
  score: number | null;
  feedback: string;
}

/** Lê a avaliação de uma resposta, com o score preso à faixa 0–100. */
export function parseEvaluation(raw: string): ParsedEvaluation {
  const parsed = extractJson(raw, 'object') as Record<string, unknown>;

  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
  if (!feedback) throw new Error('Invalid evaluation: feedback ausente');

  if (typeof parsed.score !== 'number' || Number.isNaN(parsed.score)) {
    throw new Error('Invalid evaluation: score não é número');
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  return { score, feedback };
}
