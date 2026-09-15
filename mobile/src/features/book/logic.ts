// Logica pura do detalhe do livro (spec 7.4, F5 Tarefa 7). A trava do quiz e a
// do time (chapterLockState, BER-48): abre quando a maior pagina lida alcanca o
// fim do capitulo. Capitulo sem paginacao libera (BER-72). Media so das notas
// que existem (BER-42).
import type { Answer, Chapter } from '../../types/database';
import { chapterLockState } from '../../utils/chapterGate';

export type ChapterState =
  | { kind: 'done'; average: number | null }
  | { kind: 'quiz' }
  | { kind: 'reading'; pagesLeft: number }
  | { kind: 'locked'; endPage: number }
  | { kind: 'open' };

type RespostaComCapitulo = Pick<Answer, 'comprehension_score' | 'evaluation_status'> & {
  question: { chapter_id: string };
};

/** Notas por capitulo. So resposta avaliada com nota vira numero; o resto e `null`. */
export function answersByChapter(answers: RespostaComCapitulo[]): Record<string, (number | null)[]> {
  const agrupado: Record<string, (number | null)[]> = {};
  for (const resposta of answers) {
    const nota = resposta.evaluation_status === 'completed' && resposta.comprehension_score !== null
      ? resposta.comprehension_score
      : null;
    (agrupado[resposta.question.chapter_id] ??= []).push(nota);
  }
  return agrupado;
}

function media(notas: (number | null)[]): number | null {
  const validas = notas.filter((n): n is number => typeof n === 'number');
  if (validas.length === 0) return null;
  return Math.round(validas.reduce((soma, n) => soma + n, 0) / validas.length);
}

export function chapterStates(
  chapters: Pick<Chapter, 'id' | 'number' | 'end_page'>[],
  /** `null` quando a pagina atual nao carregou: tudo abre, e o servidor trava com 403. */
  currentPage: number | null,
  answeredByChapter: Record<string, (number | null)[]>,
): Record<string, ChapterState> {
  const estados: Record<string, ChapterState> = {};
  let jaTemLendo = false;

  for (const capitulo of [...chapters].sort((a, b) => a.number - b.number)) {
    const notas = answeredByChapter[capitulo.id] ?? [];
    const respondido = notas.length > 0;

    if (currentPage === null) {
      estados[capitulo.id] = { kind: 'open' };
    } else if (typeof capitulo.end_page !== 'number') {
      estados[capitulo.id] = respondido ? { kind: 'done', average: media(notas) } : { kind: 'open' };
    } else {
      const trava = chapterLockState(capitulo.end_page, currentPage);
      if (trava.unlocked) {
        estados[capitulo.id] = respondido ? { kind: 'done', average: media(notas) } : { kind: 'quiz' };
      } else if (!jaTemLendo) {
        jaTemLendo = true;
        estados[capitulo.id] = { kind: 'reading', pagesLeft: trava.pagesLeft };
      } else {
        estados[capitulo.id] = { kind: 'locked', endPage: capitulo.end_page };
      }
    }
  }
  return estados;
}

/** O que a linha do capitulo diz sob o titulo. */
export function chapterSubtitle(state: ChapterState): string {
  switch (state.kind) {
    case 'done':
      return state.average === null ? 'avaliando' : `média ${state.average}`;
    case 'quiz':
      return 'Responder o quiz';
    case 'reading':
      return `${state.pagesLeft === 1 ? 'falta' : 'faltam'} ${state.pagesLeft} pág.`;
    case 'locked':
      return `Leia até a p. ${state.endPage} pro quiz abrir`;
    case 'open':
      return 'Abrir o quiz';
  }
}
