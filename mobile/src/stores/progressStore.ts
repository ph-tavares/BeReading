import { create } from 'zustand';
import { totalXp, levelFor } from '../game/xp';
import type { LevelInfo } from '../game/xp';
import {
  getReadingSessions,
  getMyAnswers,
  getStudentBadges,
  getStreak,
} from '../api/queries';
import type { MyAnswer } from '../api/queries';
import type { ReadingSession, Streak, Badge, StudentBadge } from '../types/database';

/**
 * XP e nível guardados um instante atrás — é o que permite a tela de conquista
 * animar o ganho (contar do XP de antes até o de agora), em vez de só mostrar
 * o número final.
 */
export interface ProgressSnapshot {
  xp: number;
  level: LevelInfo;
}

interface ProgressState {
  sessions: ReadingSession[];
  answers: MyAnswer[];
  badges: (StudentBadge & { badge: Badge })[];
  streak: Streak | null;

  /** Derivados de `src/game/xp` — nunca recalculados aqui, só repassados. */
  xp: number;
  level: LevelInfo;

  /**
   * `null` enquanto nunca houve carga: não existe "antes" ainda, e a tela deve
   * mostrar o valor pronto em vez de animar.
   *
   * Nasceu `{ xp: 0 }` e virou nulo por decisão minha, não do implementador,
   * que aliás levantou o caso. Com zero, o primeiro `refresh` de um leitor com
   * 2400 de XP produz um "ganho" de 0 até 2400, e qualquer tela que anime a
   * partir daqui faria o anel contar a vida inteira do usuário no cold start.
   *
   * Podia ser resolvido com uma heurística em cada tela ("não anima se previous
   * for zero"), e é justamente isso que não pode: três telas decidindo o mesmo
   * caso por conta própria é como o vocabulário de tom divergiu. Nulo obriga o
   * TypeScript a cobrar o tratamento uma vez, no lugar certo.
   */
  previous: ProgressSnapshot | null;

  /** Se algum `refresh` ja completou. Distingue "XP zero" de "sem dado". */
  carregado: boolean;

  refresh: (userId: string) => Promise<void>;
}

const ZERO_LEVEL = levelFor(0);

export const useProgressStore = create<ProgressState>((set, get) => ({
  sessions: [],
  answers: [],
  badges: [],
  streak: null,
  xp: 0,
  level: ZERO_LEVEL,
  previous: null,
  carregado: false,

  refresh: async (userId) => {
    const [sessions, answers, badges, streak] = await Promise.all([
      getReadingSessions(userId),
      getMyAnswers(userId),
      getStudentBadges(userId),
      getStreak(userId),
    ]);

    const xp = totalXp({ sessions, answers, badgeCount: badges.length });
    const level = levelFor(xp);

    // Quando capturar o instantâneo anterior: só quando o XP realmente muda.
    //
    // XP aqui só cresce (mais sessão, mais nota avaliada, mais conquista —
    // nenhuma delas some), então "xp !== xp atual" é um proxy seguro para
    // "chegou dado novo". Dois `refresh` seguidos que devolvem o mesmo total
    // (ex.: a tela Hoje atualiza em foco enquanto a tela de conquista ainda
    // não consumiu o ganho anterior) são o caso que este guard existe para
    // evitar: sem ele, o segundo refresh sobrescreveria `previous` com o
    // valor que acabou de virar `xp` atual, o intervalo encolheria a zero, e
    // a animação de contagem sumiria antes de a tela de conquista rodar.
    // Só avançamos `previous` quando o número efetivamente andou — e sempre
    // para o valor que era atual imediatamente antes deste refresh.
    //
    // A primeira carga é a exceção, e precisa de `carregado`, não de "xp é
    // zero": um leitor novo de verdade tem zero, e o primeiro capítulo que ele
    // fecha é o momento mais importante do produto. Se o teste de primeira
    // carga fosse `xp === 0`, esse ganho inaugural (0 para 25) seria confundido
    // com "ainda não carregou" e a tela de conquista dele apareceria parada.
    const { xp: currentXp, level: currentLevel, previous, carregado } = get();

    set({
      sessions,
      answers,
      badges,
      streak,
      xp,
      level,
      carregado: true,
      previous: !carregado
        ? null
        : xp !== currentXp
          ? { xp: currentXp, level: currentLevel }
          : previous,
    });
  },
}));
