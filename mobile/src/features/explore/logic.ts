// Logica pura de Explorar (spec 7.8, F6 Tarefa 2). Sem React: so dado e conta.
import type { Book } from '../../types/database';

export type ExploreState = 'start' | 'reading' | 'finished';

/**
 * Generos reais dos livros, em ordem alfabetica e sem repetir. Substitui o
 * CATEGORIES fixo, cujo `categoryOf` nao batia com o genero do banco e zerava
 * a lista em qualquer categoria.
 */
export function genresOf(books: Pick<Book, 'genre'>[]): string[] {
  const generos = new Set<string>();
  for (const b of books) {
    const g = b.genre?.trim();
    if (g) generos.add(g);
  }
  return [...generos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filterByGenre<T extends Pick<Book, 'genre'>>(books: T[], genre: string | null): T[] {
  if (genre === null) return books;
  return books.filter((b) => b.genre?.trim() === genre);
}

/** Estado do livro pro leitor. Livro tirado da leitura volta a ser "Começar". */
export function exploreState(statusById: Record<string, string>, bookId: string): ExploreState {
  const status = statusById[bookId];
  if (status === 'reading') return 'reading';
  if (status === 'finished') return 'finished';
  return 'start';
}

/**
 * Destaque: o primeiro livro, na ordem que `getBooks` devolve (por titulo), que
 * o leitor ainda nao comecou. Sem nenhum, nao ha destaque.
 */
export function featuredBook<T extends Pick<Book, 'id'>>(books: T[], statusById: Record<string, string>): T | null {
  return books.find((b) => exploreState(statusById, b.id) === 'start') ?? null;
}
