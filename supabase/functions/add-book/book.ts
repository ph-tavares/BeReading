// supabase/functions/add-book/book.ts
// BER-60: regra do cadastro de livro pelo leitor, fora do handler para o teste
// exercitar o código real (BER-35).
import { isValidIsbnFormat, normalizeIsbn } from '../_shared/openlibrary.ts';

export const LIMITS = {
  titleMax: 200,
  authorMax: 120,
  pagesMax: 5000,
  chaptersMax: 200,
  /** Teto de livros cadastrados por leitor: o cadastro não tem cota de plano, e sem teto vira farm de linha. */
  booksPerReader: 50,
} as const;

/**
 * Capa só da Open Library, que é de onde o lookup por ISBN (BER-72) tira. Aceitar
 * qualquer URL faria o app buscar imagem em endereço que o leitor escolheu.
 */
const COVER_PREFIX = 'https://covers.openlibrary.org/';

export interface AddBookInput {
  isbn: string | null;
  title: string;
  author: string;
  totalPages: number;
  chapterCount: number;
  coverUrl: string | null;
}

export type ParseResult = { ok: true; input: AddBookInput } | { ok: false; error: string };

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

function inteiro(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) ? valor : null;
}

export function parseAddBookInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const title = texto(b.title);
  if (!title || title.length > LIMITS.titleMax) return { ok: false, error: 'Invalid title' };

  const author = texto(b.author);
  if (!author || author.length > LIMITS.authorMax) return { ok: false, error: 'Invalid author' };

  const totalPages = inteiro(b.total_pages);
  if (totalPages === null || totalPages < 1 || totalPages > LIMITS.pagesMax) {
    return { ok: false, error: 'Invalid total_pages' };
  }

  const chapterCount = inteiro(b.chapter_count);
  if (chapterCount === null || chapterCount < 1 || chapterCount > LIMITS.chaptersMax || chapterCount > totalPages) {
    return { ok: false, error: 'Invalid chapter_count' };
  }

  let isbn: string | null = null;
  if (b.isbn !== undefined && b.isbn !== null && b.isbn !== '') {
    isbn = typeof b.isbn === 'string' ? normalizeIsbn(b.isbn) : '';
    if (!isValidIsbnFormat(isbn)) return { ok: false, error: 'Invalid ISBN format' };
  }

  const cover = texto(b.cover_url);
  const coverUrl = cover.startsWith(COVER_PREFIX) ? cover : null;

  return { ok: true, input: { isbn, title, author, totalPages, chapterCount, coverUrl } };
}

export interface EstimatedChapter {
  number: number;
  title: string;
  start_page: number;
  end_page: number;
}

/**
 * Capítulos com páginas ESTIMADAS: o livro dividido em partes iguais.
 *
 * Nenhuma fonte pública dá a página em que cada capítulo começa (investigação da
 * BER-72). Sem `end_page`, o capítulo nunca fecha: `findNewlyCompletedChapters`
 * compara `end_page` com a página lida, e com nulo a comparação é sempre falsa
 * (comentário na BER-60, 15/09). Então o quiz do livro do leitor nunca existiria.
 * Partes iguais é aproximado, mas fecha capítulo; quando a ingestão (BER-59)
 * souber a estrutura da edição, é ela quem deve corrigir.
 */
export function estimateChapters(totalPages: number, chapterCount: number): EstimatedChapter[] {
  const tamanho = totalPages / chapterCount;
  return Array.from({ length: chapterCount }, (_, i) => ({
    number: i + 1,
    title: `Capítulo ${i + 1}`,
    start_page: Math.floor(i * tamanho) + 1,
    end_page: i === chapterCount - 1 ? totalPages : Math.floor((i + 1) * tamanho),
  }));
}

/**
 * O livro que o leitor já enxerga com esse ISBN: o do catálogo, ou um que ele mesmo
 * cadastrou. Livro de outro leitor não conta, porque não é visível para ele.
 */
export function findVisibleByIsbn<T extends { added_by: string | null }>(
  rows: T[],
  userId: string,
): T | null {
  return rows.find((r) => r.added_by === null) ?? rows.find((r) => r.added_by === userId) ?? null;
}
