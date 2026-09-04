// src/utils/registerReading.ts
// Escolha do livro no registro de leitura (BER-44).
//
// O FAB abria `/register-reading`, que lia `currentBook` do store — e o único
// lugar que setava esse valor era a Home, com o PRIMEIRO livro em leitura. Quem
// lê dois livros ao mesmo tempo não conseguia registrar o segundo, e se a Home
// tivesse falhado o botão abria uma tela sem nada além de "Nenhum livro
// selecionado", sem nem um voltar.

import type { Book, StudentBook } from '../types/database';

export interface BookChoice {
  studentBook: StudentBook;
  book: Book;
}

/** Só livros em andamento entram na escolha — terminado não se registra. */
export function toChoices(rows: (StudentBook & { book: Book })[]): BookChoice[] {
  return rows
    .filter((row) => row.status === 'reading' && row.book)
    .map(({ book, ...studentBook }) => ({ studentBook: studentBook as StudentBook, book }));
}

/**
 * Qual livro abrir primeiro.
 *
 * Ordem de preferência: o pedido explicitamente (parâmetro da rota ou o que a
 * Home tinha aberto) e, na falta dele, o primeiro da lista — que vem ordenada do
 * mais recente para o mais antigo.
 */
export function pickInitialBook(
  choices: BookChoice[],
  preferredBookId?: string | null,
): BookChoice | null {
  if (choices.length === 0) return null;
  if (preferredBookId) {
    const preferred = choices.find((c) => c.book.id === preferredBookId);
    if (preferred) return preferred;
  }
  return choices[0];
}

/**
 * Resumo dos capítulos completados numa mesma sessão (BER-54).
 *
 * Quem lê 60 páginas de uma vez pode fechar dois ou três capítulos; a tela
 * mandava `completed_chapter_ids[0]` e fingia que era um só. O quiz ainda abre um
 * de cada vez — o resto fica pendente e a Home lembra —, mas a mensagem para de
 * mentir sobre quantos foram.
 */
export function summarizeCompletedChapters(ids: string[]): {
  count: number;
  firstChapterId: string | null;
} {
  return { count: ids.length, firstChapterId: ids[0] ?? null };
}

/**
 * Quantas páginas do intervalo informado já tinham sido registradas antes.
 *
 * BER-54: páginas relidas entram de novo na contagem — `pages_read` é coluna
 * **gerada** no banco (`end_page - start_page + 1`), então não há como contar só
 * as novas sem migration, que hoje é inaplicável (BER-31). O que dá para fazer
 * agora é não deixar isso acontecer em silêncio: a tela avisa antes de enviar.
 */
export function pagesAlreadyRead(start: number, end: number, currentPage: number): number {
  if (currentPage <= 0 || start > currentPage) return 0;
  return Math.min(end, currentPage) - start + 1;
}
