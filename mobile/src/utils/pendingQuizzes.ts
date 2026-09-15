// src/utils/pendingQuizzes.ts
// BER-54: `getPendingQuizChapterIds` existia em `queries.ts` e nunca foi chamada
// por ninguém — quem não respondia o quiz na hora simplesmente esquecia dele.
//
// Só que usá-la como está traria um problema maior: a query devolve TODO capítulo
// com pergunta gerada e sem resposta deste usuário, sem olhar se ele leu o livro.
// Num catálogo com 25 capítulos e um leitor que respondeu dois, o card diria
// "23 quizzes esperando" — a maioria de livros que ele nunca abriu.
//
// O filtro de "até onde o leitor chegou" mora aqui.

import type { Chapter, StudentBook } from '../types/database';

/**
 * Dos capítulos com quiz pendente, os que o leitor de fato alcançou.
 *
 * Um capítulo conta quando o livro está na lista do leitor e a página atual já
 * passou do fim do capítulo — o mesmo critério que o backend usa para considerar
 * um capítulo completo.
 */
export function filterReachedChapters(
  pendingChapters: Chapter[],
  studentBooks: StudentBook[],
): Chapter[] {
  const pageByBook = new Map(studentBooks.map((sb) => [sb.book_id, sb.current_page]));

  return pendingChapters
    .filter((chapter) => {
      const currentPage = pageByBook.get(chapter.book_id);
      if (currentPage === undefined) return false;

      // Capítulo sem paginação (BER-72) conta como alcançado.
      //
      // Isto NÃO é mudança de comportamento: já era o que acontecia, só que por
      // acidente. O tipo dizia que `end_page` era `number`, então `currentPage
      // >= null` virava `currentPage >= 0`, sempre verdadeiro. O tipo honesto
      // obrigou a escrever a decisão em vez de herdá-la de uma coerção.
      //
      // Continua sendo o comportamento certo? É discutível, e é decisão de
      // produto, não de tela: sem `end_page` não existe como saber, por número
      // de página, se o leitor terminou o capítulo. Deixar passar arrisca
      // cobrar quiz de capítulo não lido; barrar mata o quiz em todo livro
      // fora do catálogo curado, que é justamente o caso que a BER-72 veio
      // habilitar. Fica como está até alguém decidir, agora à vista.
      if (chapter.end_page === null) return true;

      return currentPage >= chapter.end_page;
    })
    .sort((a, b) => a.number - b.number);
}
