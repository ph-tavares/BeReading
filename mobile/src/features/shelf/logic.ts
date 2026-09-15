// Logica pura da Estante (spec 7.7, F6 Tarefa 1). Sem React: so dado e conta.
import type { Book, StudentBook } from '../../types/database';

type Entry = StudentBook & { book: Book };

interface RespostaComCapitulo {
  comprehension_score: number | null;
  evaluation_status: string;
  question: { chapter_id: string };
}

/** Fracao lida do livro, de 0 a 1. Livro sem total de paginas fica em 0. */
export function readProgress(entry: Pick<Entry, 'current_page'> & { book: Pick<Book, 'total_pages'> }): number {
  if (entry.book.total_pages <= 0) return 0;
  return Math.min(1, Math.max(0, entry.current_page / entry.book.total_pages));
}

/**
 * Media do livro: so as respostas avaliadas com nota, dos capitulos dele.
 * Nota ausente nao e zero (BER-42), e livro sem nenhuma nota nao tem media.
 */
export function bookAverage(answers: RespostaComCapitulo[], chapterIds: string[]): number | null {
  const capitulos = new Set(chapterIds);
  const notas = answers
    .filter((a) => capitulos.has(a.question.chapter_id))
    .filter((a) => a.evaluation_status === 'completed' && a.comprehension_score !== null)
    .map((a) => a.comprehension_score as number);
  if (notas.length === 0) return null;
  return Math.round(notas.reduce((soma, n) => soma + n, 0) / notas.length);
}

/** O subtitulo da Estante. Uso da cota e texto, nunca barra (DESIGN.md secao 10). */
export function shelfSubtitle(readingCount: number, maxBooks: number | null): string {
  if (maxBooks === null) return readingCount === 1 ? '1 livro em leitura' : `${readingCount} livros em leitura`;
  return `${readingCount} de ${maxBooks} ${maxBooks === 1 ? 'livro' : 'livros'} em leitura`;
}
