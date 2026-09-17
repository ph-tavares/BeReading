// supabase/functions/_shared/openlibrary.ts
//
// BER-72: metadado bibliográfico por ISBN (título, editora, ano, total de páginas),
// para resolver qual edição o leitor tem em mãos ao cadastrar um livro fora do
// catálogo (BER-60). Lógica pura isolada de `index.ts` para o teste exercitar o
// código real — mesmo padrão de `retry-pending-quizzes/filter.ts`.
// Movido para _shared na BER-59: a ingestão reaproveita normalizeIsbn e buildCoverUrl.
//
// Investigação que fundamenta o design (10-11/09/2026, ver comentário na BER-72):
// nem Open Library nem Google Books expõem paginação por capítulo — só o total de
// páginas da edição. Não existe fonte pública de "capítulo 4 começa na página 61".
// Por isso esta function devolve só metadado de edição; a migration que acompanha
// esta issue torna `chapters.start_page`/`end_page` opcionais, porque não há como
// preenchê-los a partir do ISBN.

export interface BookMetadata {
  title: string;
  authors: string[];
  publisher: string | null;
  publishYear: string | null;
  totalPages: number | null;
  coverUrl: string | null;
}

/** Remove hífens/espaços de um ISBN em qualquer formato de entrada. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, '').toUpperCase();
}

/** ISBN-10 (9 dígitos + dígito verificador, que pode ser X) ou ISBN-13 (13 dígitos). */
export function isValidIsbnFormat(isbn: string): boolean {
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn);
}

/** `"328p."` → 328. Usado quando `number_of_pages` não vem preenchido. */
export function parsePaginationString(pagination: string | undefined | null): number | null {
  if (!pagination) return null;
  const match = pagination.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function buildCoverUrl(coverId: number | undefined): string | null {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

/**
 * Extrai os campos que importam de uma edição da Open Library
 * (`GET /isbn/{isbn}.json`). A resposta varia por edição: `author` como array de
 * strings é o caso raro e direto; a maioria só tem `authors: [{key}]`, que exigiria
 * uma segunda chamada para resolver — não seguida aqui por enquanto, fica `[]` e o
 * leitor completa (é honesto: melhor vazio do que um autor inventado).
 */
export function parseOpenLibraryEdition(json: Record<string, unknown>): BookMetadata {
  const title = typeof json.title === 'string' ? json.title : '';
  const authors = Array.isArray(json.author)
    ? (json.author as unknown[]).filter((a): a is string => typeof a === 'string')
    : [];
  const publishers = Array.isArray(json.publishers) ? (json.publishers as unknown[]) : [];
  const publisher = typeof publishers[0] === 'string' ? (publishers[0] as string) : null;
  const publishYear = typeof json.publish_date === 'string' ? json.publish_date : null;
  const totalPages = typeof json.number_of_pages === 'number'
    ? json.number_of_pages
    : parsePaginationString(json.pagination as string | undefined);
  const covers = Array.isArray(json.covers) ? (json.covers as unknown[]) : [];
  const coverUrl = buildCoverUrl(typeof covers[0] === 'number' ? (covers[0] as number) : undefined);

  return { title, authors, publisher, publishYear, totalPages, coverUrl };
}
