// supabase/functions/scan-page/suggestions.ts
// Leitura do que o modelo devolveu sobre a foto.
//
// O extrator de JSON é o da BER-37 (`_shared/ai-json.ts`): resposta de LLM chega com
// cerca de markdown, com texto em volta, e a regex não-gulosa antiga truncava tudo no
// primeiro `}`. Aqui só mora a validação do conteúdo — o formato de
// `{ valid, rejected }` é o mesmo de `parseQuestions`, pelo mesmo motivo da BER-38:
// uma sugestão estragada não pode derrubar as outras três.

import { extractJson } from '../_shared/ai-json.ts';
import { MAX_PAGE_TEXT_CHARS } from './prompt.ts';

/** Quantas sugestões pedimos, e o teto do que aceitamos de volta (spec §3.3, D10). */
export const SUGGESTION_COUNT = 4;
/** Sugestão maior que isto não cabe no botão da tela — e deixou de ser uma pergunta. */
export const MAX_SUGGESTION_CHARS = 120;

export interface ScanResult {
  /** A foto é mesmo a página de um livro? Falso vira recusa curta, sem gravar nada. */
  isBookPage: boolean;
  pageText: string;
  suggestions: string[];
  /** O número impresso lido na foto, ou null quando ilegível. Nunca deduzido. */
  detectedPage: number | null;
  /** Sugestões descartadas, com o motivo — vão para o log, como na BER-38. */
  rejected: { item: unknown; reason: string }[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Página detectada: inteiro >= 1 e, quando sabemos o tamanho do livro, dentro dele.
 *
 * O limite superior não é preciosismo. A foto de uma página com "1984" impresso no
 * cabeçalho é exatamente o caso em que o modelo devolve o número errado com
 * confiança — e esse número viraria a oferta de "registrar até aqui" da BER-104.
 */
export function readDetectedPage(value: unknown, totalPages?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  if (totalPages && value > totalPages) return null;
  return value;
}

/**
 * Valida a resposta do modelo.
 *
 * @throws Error quando não dá para aproveitar nada — o handler trata como falha de IA,
 * avisa o time e não grava conversa nenhuma.
 */
export function parseScanResult(raw: string, totalPages?: number | null): ScanResult {
  const parsed = extractJson(raw, 'object');
  if (!isPlainObject(parsed)) throw new Error('Resposta da IA não é um objeto JSON');

  // Só `false` explícito é recusa. Um campo ausente não pode virar "não é livro" em
  // silêncio: isso mandaria o leitor tirar outra foto da mesma página, para sempre.
  if (parsed.is_book_page === false) {
    return { isBookPage: false, pageText: '', suggestions: [], detectedPage: null, rejected: [] };
  }

  const pageText = typeof parsed.page_text === 'string' ? parsed.page_text.trim() : '';
  if (!pageText) throw new Error('Resposta da IA sem transcrição da página');

  const rejected: { item: unknown; reason: string }[] = [];
  const suggestions: string[] = [];
  const cruas = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

  for (const item of cruas) {
    if (typeof item !== 'string') {
      rejected.push({ item, reason: 'não é texto' });
      continue;
    }
    const texto = item.trim();
    if (!texto) {
      rejected.push({ item, reason: 'vazia' });
      continue;
    }
    if (texto.length > MAX_SUGGESTION_CHARS) {
      rejected.push({ item, reason: `passa de ${MAX_SUGGESTION_CHARS} caracteres` });
      continue;
    }
    if (suggestions.includes(texto)) {
      rejected.push({ item, reason: 'repetida' });
      continue;
    }
    suggestions.push(texto);
  }

  if (suggestions.length === 0) {
    throw new Error('Resposta da IA sem nenhuma sugestão aproveitável');
  }

  return {
    isBookPage: true,
    // O teto do prompt não é garantia: o modelo às vezes passa dele.
    pageText: pageText.slice(0, MAX_PAGE_TEXT_CHARS),
    suggestions: suggestions.slice(0, SUGGESTION_COUNT),
    detectedPage: readDetectedPage(parsed.detected_page, totalPages),
    rejected,
  };
}
