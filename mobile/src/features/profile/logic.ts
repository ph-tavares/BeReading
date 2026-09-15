// Logica pura de Voce (spec 7.9, F6 Tarefa 3). Sem React: so dado e conta.
import { todayInSaoPaulo } from '../../game/streak';
import { formatDateBR } from '../../utils/billing';
import type { BadgeStats, DecoratedBadge } from '../../game/badges';

export interface ConstancyDay {
  date: string;
  read: boolean;
  /** Dia que ainda nao chegou, na semana corrente. */
  future: boolean;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Mapa de constancia: as ultimas `weeks` semanas, de segunda a domingo, com os
 * dias que tiveram leitura. O dia e o de Sao Paulo, a mesma virada do servidor
 * (ver src/game/streak.ts).
 */
export function constancyWeeks(
  sessions: { read_at: string }[],
  now: Date = new Date(),
  weeks = 12,
): ConstancyDay[][] {
  const hoje = todayInSaoPaulo(now);
  const dow = new Date(`${hoje}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  const segunda = addDays(hoje, dow === 0 ? -6 : 1 - dow);
  const inicio = addDays(segunda, -7 * (weeks - 1));
  const lidos = new Set(sessions.map((s) => todayInSaoPaulo(new Date(s.read_at))));

  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(inicio, w * 7 + d);
      return { date, read: lidos.has(date), future: date > hoje };
    }),
  );
}

export function readDaysIn(weeks: ConstancyDay[][]): number {
  return weeks.reduce((soma, semana) => soma + semana.filter((d) => d.read).length, 0);
}

/** Media geral so das respostas avaliadas com nota (BER-42). Sem nota, `null`. */
export function overallAverage(answers: { comprehension_score: number | null; evaluation_status: string }[]): number | null {
  const notas = answers
    .filter((a) => a.evaluation_status === 'completed' && a.comprehension_score !== null)
    .map((a) => a.comprehension_score as number);
  if (notas.length === 0) return null;
  return Math.round(notas.reduce((soma, n) => soma + n, 0) / notas.length);
}

/** Os numeros das conquistas, com as mesmas contas do award-badges. */
export function badgeStatsFrom({
  sessionCount, streak, answerCount, booksFinished, totalPages,
}: {
  sessionCount: number;
  streak: number;
  answerCount: number;
  booksFinished: number;
  totalPages: number;
}): BadgeStats {
  return {
    totalSessions: sessionCount,
    currentStreak: streak,
    quizzesAnswered: answerCount,
    booksFinished,
    totalPages,
  };
}

/** O que a conquista diz sob o nome: data, progresso ou so a descricao. */
export function badgeStatusLine(badge: Pick<DecoratedBadge, 'earned' | 'earnedAt' | 'progress' | 'description'>): string {
  if (badge.earned) return badge.earnedAt ? `Conquistada em ${formatDateBR(badge.earnedAt)}` : 'Conquistada';
  if (badge.progress) return `${badge.progress.current} de ${badge.progress.target}`;
  return badge.description;
}

export function monogram(name: string | null | undefined): string {
  const letra = name?.trim().charAt(0);
  return letra ? letra.toUpperCase() : '?';
}
