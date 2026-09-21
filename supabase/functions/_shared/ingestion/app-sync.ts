// supabase/functions/_shared/ingestion/app-sync.ts
// O que a ingestão (BER-59) muda no livro do app quando o run fecha (BER-60).
//
// 1. Capítulos do livro do leitor. No cadastro, o leitor informa quantos capítulos a edição tem,
//    e erra: o 1984 tem 24 capítulos em 3 partes, e é fácil contar 3 ou 8. Com contagens
//    diferentes, a ponte do quiz (`chapter-grounding.ts`) não sabe qual capítulo da edição é qual e
//    não usa conhecimento nenhum. Quando a ingestão confirma a estrutura, os capítulos do livro do
//    leitor passam a ser os da edição, com o rótulo "Parte X - Capítulo Y" que a ponte lê.
//    Só enquanto nenhum capítulo foi fechado: depois disso já existem quiz e respostas presos
//    àqueles capítulos, e trocar apagaria o que o leitor fez. Livro do catálogo nunca é mexido.
// 2. Quiz que ficou sem conteúdo (NO_CONTENT, BER-66). O retry horário não tenta de novo esse
//    caso, porque sem conteúdo tentar de novo não adianta. Com conhecimento publicado, adianta:
//    o quiz volta para a fila e é gerado na hora.
import { estimateChapters, type EstimatedChapter } from '../chapter-pages.ts';
import { normalizePart } from './locate.ts';
import type { StepContext } from './steps/context.ts';
import type { EditionChapter } from './types.ts';

export interface AppBook {
  id: string;
  /** null = livro do catálogo. */
  addedBy: string | null;
  totalPages: number;
  chapterCount: number;
  /** Algum capítulo já tem quiz (gerado, falho ou pendente): o leitor já fechou capítulo. */
  hasClosedChapter: boolean;
}

/** Rótulo que a ponte do quiz reconhece ("Parte 2 - Capítulo 1"). Sem parte, o título da edição. */
export function appChapterTitle(chapter: EditionChapter): string {
  const parte = chapter.partLabel ? normalizePart(chapter.partLabel) : '';
  if (/^\d+$/.test(parte) && chapter.numberInPart !== null) return `Parte ${parte} - Capítulo ${chapter.numberInPart}`;
  return chapter.title?.trim() || `Capítulo ${chapter.number}`;
}

/**
 * Capítulos novos para o livro do leitor, ou null quando não é para mexer: livro do catálogo,
 * capítulo já fechado, contagem que já bate, ou mais capítulos que páginas.
 */
export function planAppChapters(book: AppBook, edition: EditionChapter[]): EstimatedChapter[] | null {
  if (book.addedBy === null || book.hasClosedChapter) return null;
  if (edition.length === 0 || edition.length === book.chapterCount || edition.length > book.totalPages) return null;
  const ordenados = [...edition].sort((a, b) => a.number - b.number);
  return estimateChapters(book.totalPages, ordenados.length)
    .map((c, i) => ({ ...c, title: appChapterTitle(ordenados[i]) }));
}

export interface AppSyncReport {
  livros: number;
  capitulos_refeitos: number;
  quizzes_reabertos: number;
}

/** Aplica os dois ajustes a todo livro do app ligado à edição: pelo `book_id` e pelo ISBN. */
export async function syncAppBooks(
  ctx: StepContext,
  edition: { isbn: string; bookId: string | null },
  chapters: EditionChapter[],
): Promise<AppSyncReport> {
  const ids = [...new Set([edition.bookId, ...(await ctx.store.listBookIdsByIsbn(edition.isbn))].filter((id): id is string => !!id))];
  let refeitos = 0;
  for (const id of ids) {
    const book = await ctx.store.getAppBook(id);
    const plano = book ? planAppChapters(book, chapters) : null;
    if (!plano) continue;
    await ctx.store.replaceAppChapters(id, plano);
    refeitos += 1;
  }

  const reabertos = ids.length === 0 ? [] : await ctx.store.requeueNoContentQuizzes(ids);
  for (const chapterId of reabertos) {
    // Sem o disparo, o capítulo espera o retry horário (`retry-pending-quizzes` pega `pending`).
    await ctx.generateQuiz?.(chapterId).catch((err) => console.error(`[app-sync] quiz ${chapterId}: ${err}`));
  }
  return { livros: ids.length, capitulos_refeitos: refeitos, quizzes_reabertos: reabertos.length };
}
