jest.mock('../../src/api/queries', () => ({
  getReadingSessions: jest.fn(),
  getMyAnswers: jest.fn(),
  getStudentBadges: jest.fn(),
  getStreak: jest.fn(),
}));

import { useProgressStore } from '../../src/stores/progressStore';
import {
  getReadingSessions,
  getMyAnswers,
  getStudentBadges,
  getStreak,
} from '../../src/api/queries';
import type { MyAnswer } from '../../src/api/queries';
import { totalXp, levelFor } from '../../src/game/xp';
import type { ReadingSession, Streak, Badge, StudentBadge } from '../../src/types/database';

const mockedGetReadingSessions = getReadingSessions as jest.Mock;
const mockedGetMyAnswers = getMyAnswers as jest.Mock;
const mockedGetStudentBadges = getStudentBadges as jest.Mock;
const mockedGetStreak = getStreak as jest.Mock;

const sessao = (pages_read: number): ReadingSession => ({
  id: `s-${pages_read}`,
  user_id: 'u1',
  book_id: 'b1',
  start_page: 1,
  end_page: pages_read,
  pages_read,
  read_at: '2026-09-13T12:00:00.000Z',
});

const resposta = (score: number | null, status: MyAnswer['evaluation_status'] = 'completed'): MyAnswer => ({
  id: `a-${Math.random()}`,
  question_id: 'q1',
  user_id: 'u1',
  answer_text: 'resposta',
  comprehension_score: score,
  ai_feedback: null,
  answered_at: '2026-09-13T12:00:00.000Z',
  evaluation_status: status,
  evaluated_at: '2026-09-13T12:00:00.000Z',
  question: { chapter_id: 'ch1' },
});

const badge: Badge = {
  id: 'bd1',
  name: 'Primeira leitura',
  description: 'Leu a primeira sessão',
  icon_url: null,
  criteria_type: 'total_sessions',
  criteria_value: 1,
};

const studentBadge = (id: string): StudentBadge & { badge: Badge } => ({
  id,
  user_id: 'u1',
  badge_id: badge.id,
  earned_at: '2026-09-13T12:00:00.000Z',
  badge,
});

const streak: Streak = {
  id: 'st1',
  user_id: 'u1',
  current_streak: 3,
  longest_streak: 5,
  last_read_date: '2026-09-13',
};

const INITIAL_STATE = {
  sessions: [] as ReadingSession[],
  answers: [] as MyAnswer[],
  badges: [] as (StudentBadge & { badge: Badge })[],
  streak: null as Streak | null,
  xp: 0,
  level: levelFor(0),
  previous: null,
  carregado: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  useProgressStore.setState(INITIAL_STATE);
});

describe('useProgressStore', () => {
  // Este teste era vácuo: o `beforeEach` acima escreve INITIAL_STATE por
  // `setState`, então ler o estado logo depois só confirma o que o próprio
  // teste acabou de escrever. Um default errado em `create<ProgressState>(...)`
  // passaria batido. Reimportar o módulo com o registro limpo é o que faz a
  // pergunta certa: o que a store vale antes de alguém tocar nela.
  it('os defaults da store, sem ninguém ter escrito nada, são zerados', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useProgressStore: storeNova } = require('../../src/stores/progressStore');
      const state = storeNova.getState();
      expect(state.sessions).toEqual([]);
      expect(state.answers).toEqual([]);
      expect(state.badges).toEqual([]);
      expect(state.streak).toBeNull();
      expect(state.xp).toBe(0);
      expect(state.level).toEqual(levelFor(0));
      expect(state.previous).toBeNull();
      expect(state.carregado).toBe(false);
    });
  });

  it('refresh busca e guarda sessões, respostas, conquistas e sequência', async () => {
    const sessions = [sessao(10)];
    const answers = [resposta(90)];
    const badges = [studentBadge('sb1')];
    mockedGetReadingSessions.mockResolvedValue(sessions);
    mockedGetMyAnswers.mockResolvedValue(answers);
    mockedGetStudentBadges.mockResolvedValue(badges);
    mockedGetStreak.mockResolvedValue(streak);

    await useProgressStore.getState().refresh('u1');

    const state = useProgressStore.getState();
    expect(state.sessions).toEqual(sessions);
    expect(state.answers).toEqual(answers);
    expect(state.badges).toEqual(badges);
    expect(state.streak).toEqual(streak);
    expect(mockedGetReadingSessions).toHaveBeenCalledWith('u1');
    expect(mockedGetMyAnswers).toHaveBeenCalledWith('u1');
    expect(mockedGetStudentBadges).toHaveBeenCalledWith('u1');
    expect(mockedGetStreak).toHaveBeenCalledWith('u1');
  });

  // O store NÃO pode reimplementar a conta de XP/nível — só chamar src/game/xp.
  it('XP e nível derivados batem com o que src/game/xp calcula para os mesmos dados', async () => {
    const sessions = [sessao(10), sessao(4)];
    const answers = [resposta(90), resposta(null, 'pending')];
    const badges = [studentBadge('sb1')];
    mockedGetReadingSessions.mockResolvedValue(sessions);
    mockedGetMyAnswers.mockResolvedValue(answers);
    mockedGetStudentBadges.mockResolvedValue(badges);
    mockedGetStreak.mockResolvedValue(streak);

    await useProgressStore.getState().refresh('u1');

    const xpEsperado = totalXp({ sessions, answers, badgeCount: badges.length });
    const state = useProgressStore.getState();
    expect(state.xp).toBe(xpEsperado);
    expect(state.level).toEqual(levelFor(xpEsperado));
  });

  // As quatro consultas vão juntas num Promise.all. Se uma falhar (rede caindo
  // no meio, RLS negando uma delas), o store não pode ficar com metade dos
  // dados novos e metade dos velhos: a tela leria XP de um instante e sequência
  // de outro. A leitura do código diz que está certo, porque a rejeição
  // acontece antes de qualquer `set`. Isso é diferente de estar testado.
  it('refresh que falha no meio não deixa o store pela metade', async () => {
    mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
    mockedGetMyAnswers.mockResolvedValue([]);
    mockedGetStudentBadges.mockResolvedValue([]);
    mockedGetStreak.mockResolvedValue(streak);
    await useProgressStore.getState().refresh('u1');

    const antes = useProgressStore.getState();
    const instantaneo = {
      sessions: antes.sessions,
      answers: antes.answers,
      badges: antes.badges,
      streak: antes.streak,
      xp: antes.xp,
      previous: antes.previous,
    };

    mockedGetReadingSessions.mockResolvedValue([sessao(10), sessao(30)]);
    mockedGetStreak.mockRejectedValue(new Error('rede caiu'));

    await expect(useProgressStore.getState().refresh('u1')).rejects.toThrow('rede caiu');

    const depois = useProgressStore.getState();
    expect({
      sessions: depois.sessions,
      answers: depois.answers,
      badges: depois.badges,
      streak: depois.streak,
      xp: depois.xp,
      previous: depois.previous,
    }).toEqual(instantaneo);
  });

  describe('instantâneo anterior (previous)', () => {
    // A primeira carga não é um ganho. Um leitor com 2400 de XP abrindo o app
    // não "ganhou" 2400 agora, e se previous nascesse em zero qualquer tela que
    // anime a partir dele contaria a vida inteira do usuário no cold start.
    it('a primeira carga não inventa um ganho: previous continua nulo', async () => {
      mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);

      await useProgressStore.getState().refresh('u1');

      const state = useProgressStore.getState();
      expect(state.previous).toBeNull();
      expect(state.carregado).toBe(true);
      expect(state.xp).toBe(50); // 10 páginas × XP_PER_PAGE
    });

    // O contra-teste do de cima, e o que impede a correção de ir longe demais:
    // leitor novo tem XP zero de verdade, e o primeiro capítulo que ele fecha é
    // o momento mais importante do produto. Se "primeira carga" fosse testada
    // por `xp === 0` em vez de por `carregado`, esse ganho inaugural apareceria
    // parado na tela.
    it('o primeiro ganho de um leitor zerado anima, e não é confundido com cold start', async () => {
      mockedGetReadingSessions.mockResolvedValue([]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);
      await useProgressStore.getState().refresh('u1'); // cold start, xp 0

      expect(useProgressStore.getState().previous).toBeNull();

      mockedGetReadingSessions.mockResolvedValue([sessao(5)]);
      await useProgressStore.getState().refresh('u1'); // primeiro capítulo: 0 -> 25

      const state = useProgressStore.getState();
      expect(state.xp).toBe(25);
      expect(state.previous).toEqual({ xp: 0, level: levelFor(0) });
    });

    it('um segundo refresh com XP maior avança previous para o valor anterior', async () => {
      mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);
      await useProgressStore.getState().refresh('u1'); // carga inicial, xp 50

      mockedGetReadingSessions.mockResolvedValue([sessao(10), sessao(20)]);
      await useProgressStore.getState().refresh('u1'); // xp: 50 -> 150

      const state = useProgressStore.getState();
      expect(state.previous).toEqual({ xp: 50, level: levelFor(50) });
      expect(state.xp).toBe(150);
    });

    // O bug que o brief pede para evitar: um segundo refresh que não traz
    // XP novo não pode sobrescrever previous com o valor que acabou de virar
    // "atual" — isso apagaria o intervalo que a tela de conquista anima.
    it('um refresh sem XP novo NÃO sobrescreve o instantâneo anterior', async () => {
      mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);
      await useProgressStore.getState().refresh('u1'); // carga inicial, xp 50

      mockedGetReadingSessions.mockResolvedValue([sessao(10), sessao(20)]);
      await useProgressStore.getState().refresh('u1'); // xp: 50 -> 150, previous = 50

      await useProgressStore.getState().refresh('u1'); // mesmos dados, xp continua 150

      const state = useProgressStore.getState();
      expect(state.xp).toBe(150);
      expect(state.previous).toEqual({ xp: 50, level: levelFor(50) }); // sobreviveu
    });
  });
});
