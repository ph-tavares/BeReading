// supabase/functions/_shared/ingestion/parts.ts
// Em que parte do livro está o texto (BER-59). Obra dividida em partes numera os capítulos dentro
// de cada parte, então sem a parte um "capítulo 1" da Parte 2 vira o capítulo 1 do livro e leva
// spoiler do meio do livro para o começo. Pedir a parte ao modelo não funcionou: no quinto teste
// do 1984, nenhuma das 803 afirmações voltou com parte, nem das fontes cujo texto traz "SEGUNDA
// PARTE" nem das páginas cuja URL diz "book-2-chapter-1". Aqui a parte é achada pelo nosso código.

/** "Parte 2", "Segunda Parte", "Part Two", "Book III", "Livro 2" — no título, na URL ou no texto. */
const PART_WORD = '(?:parte|part|livro|book)';
const PART_NUMBER = '(?:\\d{1,2}|[ivx]{1,4}|um|dois|tres|quatro|one|two|three|four)';
const ORDINAL_FIRST = '(?:primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|first|second|third|fourth)';

const IN_TEXT = new RegExp(`^[^\\p{L}\\n]{0,4}(?:${PART_WORD}\\s+(${PART_NUMBER})|(${ORDINAL_FIRST})\\s+${PART_WORD})\\b`, 'imu');
const IN_URL = new RegExp(`${PART_WORD}[-_/ ]?(${PART_NUMBER})\\b`, 'iu');

const ORDINAL_TO_NUMBER: Record<string, string> = {
  primeira: '1', primeiro: '1', first: '1',
  segunda: '2', segundo: '2', second: '2',
  terceira: '3', terceiro: '3', third: '3',
  quarta: '4', quarto: '4', fourth: '4',
};

/** "two", "ii", "dois" e "2" são a mesma parte: o rótulo canônico é sempre o número. */
const TO_NUMBER: Record<string, string> = {
  um: '1', one: '1', i: '1',
  dois: '2', two: '2', ii: '2',
  tres: '3', three: '3', iii: '3',
  quatro: '4', four: '4', iv: '4',
};

function canonical(token: string): string | null {
  const value = token.toLowerCase();
  if (/^\d{1,2}$/.test(value)) return String(Number(value));
  return Object.hasOwn(TO_NUMBER, value) ? TO_NUMBER[value] : null;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Devolve o rótulo canônico da parte ("Parte 2") ou null. */
export function partLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = IN_TEXT.exec(normalize(value));
  if (!match) return null;
  const ordinal = match[2] ? ORDINAL_TO_NUMBER[match[2]] ?? null : null;
  const numero = match[1] ? canonical(match[1]) : ordinal;
  return numero ? `Parte ${numero}` : null;
}

/**
 * Parte indicada pela URL ou pelo título da página (ex.: `/lit/1984/book-2-chapter-1`, "Part 3,
 * Chapter 1"). Quando existe, vale para todas as afirmações daquela página.
 */
export function partFromSource(url: string | null, title: string | null): string | null {
  return partLabel(title) ?? (url ? partLabelFromUrl(url) : null);
}

function partLabelFromUrl(url: string): string | null {
  const match = IN_URL.exec(normalize(decodeURIComponent(url)));
  return match ? `Parte ${match[1]}` : null;
}

export interface ChunkPart {
  /** Parte em que o bloco começa; null quando ainda não se sabe. */
  start: string | null;
  /** Parte em que o bloco termina, para o bloco seguinte continuar dela. */
  end: string | null;
  /** O bloco troca de parte no meio: não dá para dizer a parte de cada afirmação dele. */
  changes: boolean;
  /** Cabeçalhos de parte no bloco. `end` vem do último, então com algum ele é confiável. */
  headings: number;
}

/**
 * Onde o bloco está, a partir dos cabeçalhos de parte que ele contém e da parte que vinha do bloco
 * anterior. Bloco que muda de parte no meio não atribui parte a nada: metade das afirmações seria
 * marcada com a parte errada, e marcar conteúdo do meio do livro como início é justamente o que
 * produz spoiler.
 */
export function chunkPart(chunk: string, running: string | null): ChunkPart {
  const linhas = chunk.split('\n');
  const headings: { label: string; linha: number }[] = [];
  linhas.forEach((linha, i) => {
    const label = partLabel(linha);
    if (label && label !== headings[headings.length - 1]?.label) headings.push({ label, linha: i });
  });
  if (headings.length === 0) return { start: running, end: running, changes: false, headings: 0 };

  const last = headings[headings.length - 1].label;
  // Cabeçalho nas primeiras linhas não é troca no meio: o bloco inteiro é da parte nova.
  const comTexto = linhas.findIndex((l) => l.trim() !== '');
  const noComeco = headings.length === 1 && headings[0].linha <= comTexto;
  if (noComeco) return { start: last, end: last, changes: false, headings: 1 };
  return { start: running, end: last, changes: true, headings: headings.length };
}

/**
 * A parte herdada do bloco anterior deixa de valer quando a numeração de capítulo recua — a fonte
 * saiu do capítulo 8 e voltou ao 1, ou seja, mudou de parte — sem que um cabeçalho novo diga qual
 * parte é. Continuar na anterior transforma "não sei" em "Parte 1": foi assim que um PDF longo do
 * archive.org mandou Julia e a Sala 101 para o capítulo 1 no sétimo teste do 1984 (BER-59).
 */
export function partStillValid(maxChapterSeen: number | null, chapterInChunk: number | null): boolean {
  if (maxChapterSeen === null || chapterInChunk === null) return true;
  return chapterInChunk >= maxChapterSeen;
}

/**
 * Parte de cada capítulo da lista que o bloco declara (defeito 5 da BER-59). Diferente das
 * afirmações, a lista vem em ordem de leitura, e o recomeço da numeração (8 e depois 1) marca onde
 * a parte troca. Então dá para separar um bloco que troca de parte no meio, desde que tenha um
 * cabeçalho só: antes do recomeço é a parte de antes, depois é a do cabeçalho. Sem parte anterior
 * conhecida (o primeiro bloco, com o título do livro antes de "PART ONE"), tudo é da parte do
 * cabeçalho. Errar aqui não vira spoiler: a lista só serve à estrutura, e `wholeBookNumbering`
 * recusa a lista inteira se as partes não fecharem.
 */
export function declaredWithParts<T extends { number: number; part: string | null; numberInPart: number | null }>(
  entries: T[],
  block: ChunkPart,
  parte: string | null,
): T[] {
  const tag = (e: T, p: string | null): T => (p && !e.part ? { ...e, part: p, numberInPart: e.numberInPart ?? e.number } : e);
  if (!block.changes) return entries.map((e) => tag(e, parte));
  if (block.headings !== 1) return entries;

  let atual = block.start ?? block.end;
  let anterior: number | null = null;
  return entries.map((e) => {
    if (anterior !== null && e.number < anterior) atual = block.end;
    anterior = e.number;
    return tag(e, atual);
  });
}

/**
 * Parte que o bloco seguinte herda. Bloco com cabeçalho de parte passa a do último cabeçalho, que
 * é confiável mesmo quando o próprio bloco ficou sem parte por trocar no meio. Antes, esse bloco
 * passava `null` e, no 1984 do Gutenberg AU (run local de 21/09/2026), a parte não chegou a
 * nenhum dos blocos: o cabeçalho "PART ONE" vinha depois do título, no meio do primeiro.
 */
export function partForNextChunk(block: ChunkPart, parte: string | null): string | null {
  if (block.headings > 0) return block.end;
  return parte === null ? null : block.end;
}

/**
 * Maior capítulo visto para o bloco seguinte comparar (`partStillValid`). Parte nova recomeça a
 * contagem: bloco que troca de parte no meio não sabe quais capítulos são de depois do cabeçalho,
 * então zera (null); bloco que começa com o cabeçalho conta só os capítulos dele.
 */
export function nextMaxChapter(block: ChunkPart, maxChapterSeen: number | null, chaptersInBlock: number[]): number | null {
  if (block.changes) return null;
  const base = block.headings > 0 ? 0 : maxChapterSeen ?? 0;
  return Math.max(base, ...chaptersInBlock, 0);
}
