// supabase/functions/register-reading-session/reading.ts
// Lógica pura do registro de leitura, exportada para ser testada de verdade
// (BER-35). Antes, `index.test.ts` redefinia cópias destas funções e testava as
// cópias — e a de streak (`calculateNewStreak`, devolvendo 1/0/-1) nem existia
// no handler, que calcula os dois valores direto. Ou seja: a regra de streak
// nunca teve teste, apesar dos 4 verdes que diziam o contrário.

const SAOPAULO_OFFSET = -3; // UTC-3

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function getTodayInSaoPaulo(now: Date = new Date()): string {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const sp = new Date(utc + SAOPAULO_OFFSET * 3600000);
  return sp.toISOString().split('T')[0];
}

/** Página mais alta já alcançada nas sessões anteriores. */
export function getMaxPageReached(sessions: { end_page: number }[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map(s => s.end_page));
}

/** Capítulos que passaram de "não completo" para "completo" com esta sessão. */
export function findNewlyCompletedChapters<T extends { end_page: number }>(
  chapters: T[],
  previousMaxPage: number,
  newMaxPage: number,
): T[] {
  return chapters.filter(
    ch => ch.end_page > previousMaxPage && ch.end_page <= newMaxPage
  );
}

export interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_read_date: string | null;
}

/**
 * Sequência depois de registrar uma leitura em `today`.
 *
 * Regra preservada exatamente como estava inline no handler:
 *   - sem registro anterior -> começa em 1;
 *   - já leu hoje -> não mexe em nada (registrar duas vezes no mesmo dia não
 *     aumenta a sequência);
 *   - leu ontem -> +1;
 *   - qualquer outro intervalo -> volta para 1.
 */
export function nextStreak(
  streak: StreakRow | null | undefined,
  today: string,
): { current: number; longest: number } {
  if (!streak) return { current: 1, longest: 1 };

  if (streak.last_read_date === today) {
    return { current: streak.current_streak, longest: streak.longest_streak };
  }

  const last = new Date(streak.last_read_date as string);
  const todayDate = new Date(today);
  const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / 86400000);
  const current = diffDays === 1 ? streak.current_streak + 1 : 1;

  return { current, longest: Math.max(current, streak.longest_streak) };
}
