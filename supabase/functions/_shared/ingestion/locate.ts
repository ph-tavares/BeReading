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
    if (ORDINALS[word]) return ORDINALS[word];
    if (ROMAN[word]) return ROMAN[word];
  }
  return words.filter((w) => w !== 'parte' && w !== 'part' && w !== 'livro' && w !== 'book').join(' ');
}

export function locateChapter(ref: ChapterRef | null, chapters: EditionChapter[]): EditionChapter | null {
  if (!ref) return null;
  const hasParts = chapters.some((c) => c.partLabel !== null);
  const matches: EditionChapter[][] = [];

  if (ref.part && ref.numberInPart !== null) {
    const part = normalizePart(ref.part);
    matches.push(chapters.filter((c) => normalizePart(c.partLabel) === part && c.numberInPart === ref.numberInPart));
  }
  const title = normalizeTitle(ref.title);
  if (title) matches.push(chapters.filter((c) => normalizeTitle(c.title) === title));
  if (ref.number !== null && !ref.part && !hasParts) {
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
];

export function looksForwardReferencing(statement: string): boolean {
  const text = stripAccents(statement.toLowerCase());
  return FORWARD_PATTERNS.some((pattern) => pattern.test(text));
}
