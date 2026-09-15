// Estados de capitulo do detalhe do livro (spec 7.4, F5 Tarefa 7). A trava e a
// mesma do time (chapterGate, BER-48): o quiz abre quando a maior pagina lida
// alcanca o fim do capitulo. Pagina nula libera (BER-72). Media so das notas (BER-42).
import { answersByChapter, chapterStates } from '../../../src/features/book/logic';

const cap = (id: string, number: number, end_page: number | null) => ({ id, number, end_page });

const CAPITULOS = [cap('c3', 3, 90), cap('c1', 1, 30), cap('c2', 2, 60), cap('c4', 4, null)];

describe('chapterStates', () => {
  it('pagina atual desconhecida: tudo aberto, o servidor ainda trava com 403', () => {
    const estados = chapterStates(CAPITULOS, null, {});
    expect(Object.values(estados).every((e) => e.kind === 'open')).toBe(true);
  });

  it('parou na 45: feito com media, lendo com o que falta, trancado com a pagina, sem paginacao aberto', () => {
    const estados = chapterStates(CAPITULOS, 45, { c1: [80, 60] });
    expect(estados.c1).toEqual({ kind: 'done', average: 70 });
    expect(estados.c2).toEqual({ kind: 'reading', pagesLeft: 15 });
    expect(estados.c3).toEqual({ kind: 'locked', endPage: 90 });
    expect(estados.c4).toEqual({ kind: 'open' });
  });

  it('capitulo alcancado sem resposta: quiz esperando', () => {
    expect(chapterStates(CAPITULOS, 45, {}).c1).toEqual({ kind: 'quiz' });
  });

  it('pagina exatamente no fim do capitulo ja alcanca (mesma conta do servidor)', () => {
    expect(chapterStates(CAPITULOS, 60, {}).c2).toEqual({ kind: 'quiz' });
  });

  it('respostas sem nota ainda (BER-42): feito, media nula, nunca zero', () => {
    expect(chapterStates(CAPITULOS, 45, { c1: [null, null] }).c1).toEqual({ kind: 'done', average: null });
  });

  it('media ignora as pendentes', () => {
    expect(chapterStates(CAPITULOS, 45, { c1: [90, null] }).c1).toEqual({ kind: 'done', average: 90 });
  });

  it('sem paginacao mas respondido: feito (BER-72)', () => {
    expect(chapterStates(CAPITULOS, 45, { c4: [70] }).c4).toEqual({ kind: 'done', average: 70 });
  });

  it('livro todo lido: nenhum trancado nem lendo', () => {
    const estados = chapterStates(CAPITULOS, 328, {});
    expect(Object.values(estados).map((e) => e.kind).sort()).toEqual(['open', 'quiz', 'quiz', 'quiz']);
  });
});

describe('answersByChapter', () => {
  it('agrupa as notas por capitulo; so avaliada com nota vira numero', () => {
    const agrupado = answersByChapter([
      { comprehension_score: 80, evaluation_status: 'completed', question: { chapter_id: 'c1' } },
      { comprehension_score: null, evaluation_status: 'pending', question: { chapter_id: 'c1' } },
      { comprehension_score: 40, evaluation_status: 'failed', question: { chapter_id: 'c2' } },
    ]);
    expect(agrupado).toEqual({ c1: [80, null], c2: [null] });
  });
});
