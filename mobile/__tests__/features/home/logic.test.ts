import {
  currentChapterGoal,
  daysSinceLastSession,
  readSessionToday,
  chooseAssistantReason,
} from '../../../src/features/home/logic';
import type { Chapter, ReadingSession } from '../../../src/types/database';

const chapter = (over: Partial<Chapter>): Chapter => ({
  id: `c-${over.number}`,
  book_id: 'b1',
  number: 1,
  title: null,
  start_page: 1,
  end_page: 10,
  ...over,
});

const sessao = (bookId: string, readAt: string): ReadingSession => ({
  id: `s-${readAt}`,
  user_id: 'u1',
  book_id: bookId,
  start_page: 1,
  end_page: 2,
  pages_read: 1,
  read_at: readAt,
});

describe('currentChapterGoal', () => {
  it('acha o capitulo corrente pela paginacao e calcula quanto falta', () => {
    const chapters = [
      chapter({ number: 1, end_page: 30 }),
      chapter({ number: 2, end_page: 60 }),
      chapter({ number: 3, end_page: 112 }),
      chapter({ number: 4, end_page: 150 }),
    ];
    // Este teste passaria com a implementacao errada "primeiro capitulo da
    // lista" se a pagina atual estivesse no capitulo 1 — por isso o valor
    // testado (84) cai deliberadamente no MEIO da lista (capitulo 3).
    expect(currentChapterGoal(chapters, 84)).toEqual({
      chapterNumber: 3,
      totalChapters: 4,
      remainingPages: 112 - 84,
    });
  });

  it('sem nenhum capitulo paginado, a meta some (nao inventa numero)', () => {
    const chapters = [
      chapter({ number: 1, end_page: null, start_page: null }),
      chapter({ number: 2, end_page: null, start_page: null }),
    ];
    expect(currentChapterGoal(chapters, 84)).toBeNull();
  });

  it('pagina atual ja passou de todos os capitulos paginados: sem meta', () => {
    const chapters = [chapter({ number: 1, end_page: 30 }), chapter({ number: 2, end_page: 60 })];
    expect(currentChapterGoal(chapters, 200)).toBeNull();
  });

  it('sem capitulo nenhum, a meta some', () => {
    expect(currentChapterGoal([], 10)).toBeNull();
  });

  // Achado RELEVANTE da revisao da Tarefa 4: sem `start_page`, a funcao
  // "pulava" o capitulo sem paginacao e apontava o proximo paginado mesmo
  // quando o leitor ainda nao tinha chegado nele. Com capitulos 1 (end 30),
  // 2 (sem paginacao) e 3 (start 61, end 90), a pagina 50 esta DEPOIS do
  // capitulo 1 mas ANTES do inicio do capitulo 3 — o leitor esta em algum
  // ponto do capitulo 2, sem paginacao pra confirmar onde. Apontar "cap. 3"
  // seria o mesmo tipo de numero chutado que a regra existe pra evitar.
  it('capitulo sem paginacao antes da pagina atual: a meta some, nao aponta o capitulo seguinte', () => {
    const chapters = [
      chapter({ number: 1, start_page: 1, end_page: 30 }),
      chapter({ number: 2, start_page: null, end_page: null }),
      chapter({ number: 3, start_page: 61, end_page: 90 }),
    ];
    expect(currentChapterGoal(chapters, 50)).toBeNull();
  });

  it('capitulo seguinte paginado alcancado de verdade (pagina >= start_page): a meta aparece', () => {
    const chapters = [
      chapter({ number: 1, start_page: 1, end_page: 30 }),
      chapter({ number: 2, start_page: null, end_page: null }),
      chapter({ number: 3, start_page: 61, end_page: 90 }),
    ];
    expect(currentChapterGoal(chapters, 65)).toEqual({
      chapterNumber: 3,
      totalChapters: 3,
      remainingPages: 25,
    });
  });

  // O buraco que sobrou da rodada de correcao 1, declarado pelo proprio
  // implementador: as duas colunas sao nulaveis de forma INDEPENDENTE, entao
  // um capitulo pode ter `end_page` e nao ter `start_page`. Nesse caso a prova
  // pelo inicio nao existe, e a cena volta a mentir se ninguem olhar o que
  // veio antes.
  it('candidato com end_page mas SEM start_page, depois de um capitulo sem paginacao: sem meta', () => {
    const chapters = [
      chapter({ number: 1, start_page: 1, end_page: 30 }),
      chapter({ number: 2, start_page: null, end_page: null }),
      chapter({ number: 3, start_page: null, end_page: 90 }),
    ];
    // O leitor esta na 50: passou do capitulo 1, mas nada prova que passou do 2.
    expect(currentChapterGoal(chapters, 50)).toBeNull();
  });

  // O contra-teste, que impede a regra acima de ir longe demais: sem furo
  // nenhum antes, a falta de `start_page` no candidato nao atrapalha, porque a
  // corrida paginada ja prova que o leitor chegou nele.
  it('candidato sem start_page, mas com todos os anteriores paginados: a meta aparece', () => {
    const chapters = [
      chapter({ number: 1, start_page: 1, end_page: 30 }),
      chapter({ number: 2, start_page: null, end_page: 90 }),
    ];
    expect(currentChapterGoal(chapters, 50)).toEqual({
      chapterNumber: 2,
      totalChapters: 2,
      remainingPages: 40,
    });
  });

});

describe('daysSinceLastSession', () => {
  it('conta dias corridos desde a sessao mais recente do livro', () => {
    const sessions = [sessao('b1', '2026-09-10T12:00:00.000Z'), sessao('b1', '2026-09-08T12:00:00.000Z')];
    const agora = new Date('2026-09-13T12:00:00.000Z');
    expect(daysSinceLastSession(sessions, 'b1', agora)).toBe(3);
  });

  it('sem sessao nenhuma do livro, devolve null (nao inventa "parado ha 0 dias")', () => {
    const sessions = [sessao('outro-livro', '2026-09-10T12:00:00.000Z')];
    expect(daysSinceLastSession(sessions, 'b1', new Date('2026-09-13T12:00:00.000Z'))).toBeNull();
  });

  it('leu hoje mesmo: zero dias', () => {
    const sessions = [sessao('b1', '2026-09-13T10:00:00.000Z')];
    expect(daysSinceLastSession(sessions, 'b1', new Date('2026-09-13T20:00:00.000Z'))).toBe(0);
  });
});

describe('readSessionToday', () => {
  it('verdadeiro quando ha sessao no dia de hoje (fuso de Sao Paulo)', () => {
    const sessions = [sessao('b1', '2026-09-13T10:00:00.000Z')];
    expect(readSessionToday(sessions, new Date('2026-09-13T20:00:00.000Z'))).toBe(true);
  });

  it('falso sem sessao hoje', () => {
    const sessions = [sessao('b1', '2026-09-12T10:00:00.000Z')];
    expect(readSessionToday(sessions, new Date('2026-09-13T20:00:00.000Z'))).toBe(false);
  });

  it('falso sem sessao nenhuma', () => {
    expect(readSessionToday([], new Date('2026-09-13T20:00:00.000Z'))).toBe(false);
  });
});

describe('chooseAssistantReason', () => {
  const agora = new Date('2026-09-13T22:00:00.000Z'); // 19h em Sao Paulo: depois das 18h

  it('quiz pendente vence tudo', () => {
    const r = chooseAssistantReason({
      pendingQuiz: { chapterId: 'ch1', chapterNumber: 3, questionCount: 4 },
      streak: 5,
      readToday: false,
      staleDays: 10,
      now: agora,
    });
    expect(r).toEqual({ kind: 'quiz', chapterId: 'ch1', chapterNumber: 3, questionCount: 4 });
  });

  it('sem quiz, sequencia em risco aparece', () => {
    const r = chooseAssistantReason({
      pendingQuiz: null,
      streak: 4,
      readToday: false,
      staleDays: null,
      now: agora,
    });
    expect(r).toEqual({ kind: 'streakRisk', hoursLeft: 5 });
  });

  it('sem quiz e sem risco, livro parado ha 3 dias ou mais aparece', () => {
    const r = chooseAssistantReason({
      pendingQuiz: null,
      streak: 4,
      readToday: true, // ja leu hoje: sem risco de sequencia
      staleDays: 3,
      now: agora,
    });
    expect(r).toEqual({ kind: 'stale', days: 3 });
  });

  it('livro parado ha menos de 3 dias nao acorda o assistente', () => {
    const r = chooseAssistantReason({
      pendingQuiz: null,
      streak: 4,
      readToday: true,
      staleDays: 2,
      now: agora,
    });
    expect(r).toBeNull();
  });

  it('nada a dizer: sem card', () => {
    const r = chooseAssistantReason({
      pendingQuiz: null,
      streak: 0,
      readToday: true,
      staleDays: null,
      now: new Date('2026-09-13T14:00:00.000Z'), // manha em SP
    });
    expect(r).toBeNull();
  });
});
