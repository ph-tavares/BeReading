/**
 * BER-48: o quiz de um capítulo só abre para quem leu até o fim dele.
 *
 * A regra é a mesma do servidor (`evaluate-answer`, `_shared/progress.ts`): a maior
 * página registrada precisa alcançar a última página do capítulo. `currentPage` vem
 * de `student_books.current_page`, que o `register-reading-session` grava com
 * exatamente essa maior página.
 */
export interface ChapterLock {
  unlocked: boolean;
  /** Quantas páginas faltam até o fim do capítulo. 0 quando liberado. */
  pagesLeft: number;
}

export function chapterLockState(chapterEndPage: number, currentPage: number): ChapterLock {
  const pagesLeft = Math.max(0, chapterEndPage - currentPage);
  return { unlocked: pagesLeft === 0, pagesLeft };
}
