// supabase/functions/_shared/ingestion/locate.ts
// Guarda 1 contra spoiler e contra fato no capítulo errado (BER-59, spec §6.2 e §6.4):
// afirmação só entra num capítulo quando a referência da fonte aponta para um único
// capítulo da edição. Ambíguo, sem referência ou antecipando o futuro: fica de fora.
import type { ChapterRef, EditionChapter } from './types.ts';

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function normalizeTitle(title: string | null): string {
  if (!title) return '';
  return stripAccents(title.toLowerCase())
    .replace(/^\s*(capitulo|chapter|cap\.)\s*[0-9ivxlc]+\s*[-:.–—]?\s*/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const ORDINALS: Record<string, string> = {
  um: '1', uma: '1', primeira: '1', primeiro: '1', one: '1', first: '1',
  dois: '2', duas: '2', segunda: '2', segundo: '2', two: '2', second: '2',
  tres: '3', terceira: '3', terceiro: '3', three: '3', third: '3',
  quatro: '4', quarta: '4', quarto: '4', four: '4', fourth: '4',
  cinco: '5', quinta: '5', quinto: '5', five: '5', fifth: '5',
};

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

export function normalizePart(part: string | null): string {
  if (!part) return '';
  const words = stripAccents(part.toLowerCase()).match(/[a-z0-9]+/g) ?? [];
  for (const word of words) {
    if (/^\d+$/.test(word)) return String(Number(word));
    // `hasOwn`: uma palavra como "constructor" não pode achar a função do protótipo (BER-59).
    if (Object.hasOwn(ORDINALS, word)) return ORDINALS[word];
    if (Object.hasOwn(ROMAN, word)) return ROMAN[word];
  }
  return words.filter((w) => w !== 'parte' && w !== 'part' && w !== 'livro' && w !== 'book').join(' ');
}

/**
 * Partes da edição, na ordem. Quando a estrutura confirmada não traz rótulo de parte, a parte nova
 * aparece no reinício de `number_in_part` (em 1984: 1..8, 1..10, 1..6). Saber disso é o que impede
 * de tratar o "capítulo 1" de uma fonte sobre a Parte 2 como o capítulo 1 do livro (BER-59).
 */
export function partsOf(chapters: EditionChapter[]): EditionChapter[][] {
  const parts: EditionChapter[][] = [];
  for (const chapter of [...chapters].sort((a, b) => a.number - b.number)) {
    const current = parts[parts.length - 1];
    const startsPart = current === undefined ||
      (chapter.partLabel !== null && normalizePart(chapter.partLabel) !== normalizePart(current[0].partLabel)) ||
      (chapter.numberInPart === 1 && current[current.length - 1].numberInPart !== null && current[current.length - 1].numberInPart !== 0);
    if (startsPart || current === undefined) parts.push([chapter]);
    else current.push(chapter);
  }
  return parts;
}

export interface LocateOptions {
  /**
   * A fonte numera os capítulos pelo livro inteiro (o sumário dela passa da primeira parte). Sem
   * essa evidência, um número solto numa obra dividida em partes é ambíguo — "capítulo 1" tanto
   * pode ser o primeiro do livro quanto o primeiro da Parte 2 — e a afirmação fica sem capítulo.
   */
  sourceNumbersWholeBook?: boolean;
}

export function locateChapter(
  ref: ChapterRef | null,
  chapters: EditionChapter[],
  options: LocateOptions = {},
): EditionChapter | null {
  if (!ref) return null;
  const parts = partsOf(chapters);
  const hasParts = parts.length > 1;
  const matches: EditionChapter[][] = [];

  if (ref.part && ref.numberInPart !== null) {
    const wanted = normalizePart(ref.part);
    const byLabel = chapters.filter((c) =>
      c.partLabel !== null && normalizePart(c.partLabel) === wanted && c.numberInPart === ref.numberInPart
    );
    // Sem rótulo na estrutura confirmada, "Parte 2" é a segunda parte na ordem do livro.
    const index = Number(wanted);
    const byIndex = Number.isInteger(index) && index >= 1 && index <= parts.length
      ? parts[index - 1].filter((c) => (c.numberInPart ?? c.number) === ref.numberInPart)
      : [];
    matches.push(byLabel.length > 0 ? byLabel : byIndex);
  }
  const title = normalizeTitle(ref.title);
  if (title) matches.push(chapters.filter((c) => normalizeTitle(c.title) === title));
  if (ref.number !== null && !ref.part && (!hasParts || options.sourceNumbersWholeBook === true)) {
    matches.push(chapters.filter((c) => c.number === ref.number));
  }

  if (matches.length === 0 || matches.some((m) => m.length !== 1)) return null;
  const [first] = matches[0];
  return matches.every((m) => m[0].id === first.id) ? first : null;
}

const FORWARD_PATTERNS: RegExp[] = [
  /\bmais tarde\b/i,
  /\b(no|ao) (fim|final) do (livro|romance)\b/i,
  /\b(sera|vai ser) revelad[oa]\b/i,
  /\bdescobrira\b/i,
  /\b(nos )?(proximos|seguintes|posteriores) capitulos\b/i,
  /\bcapitulos? (seguintes?|posteriores?)\b/i,
  /\blater\b/i,
  /\bin the end\b/i,
  /\bwill (later )?(be revealed|discover|learn|find out)\b/i,
  /\bsubsequent chapters?\b/i,
  /\banos depois\b/i,
  /\bviria a\b/i,
  /\bacabaria por\b/i,
  /\bestava destinad[oa] a\b/i,
  /\beventually\b/i,
  /\bturns out\b/i,
  /\bdestined to\b/i,
  /\bgoes on to\b/i,
];

export function looksForwardReferencing(statement: string): boolean {
  const text = stripAccents(statement.toLowerCase());
  return FORWARD_PATTERNS.some((pattern) => pattern.test(text));
}
