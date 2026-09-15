// Conquistas: ícone e progresso a partir do criteria_type REAL do banco (BER-77).
//
// O BadgeGrid antigo mapeava 'pages_read', 'books_finished', 'quizzes_completed'
// e 'answers_submitted' — nenhum desses existe. Os tipos do seed são os oito
// abaixo, e por isso quase toda medalha caía no ícone genérico.
//
// O progresso espelha evaluateBadges (award-badges/index.ts) só nos tipos que o
// app já tem em mãos. Onde o servidor precisa de conta que o app não faz
// (média por livro, livro fora da grade, reflexão acima de 80), devolve null: a
// medalha aparece com a descrição, sem barra. Inventar barra seria número falso.

import {
  BookOpen, Flame, MessageSquare, Trophy, Brain, Library, Compass, Target, Award,
} from 'lucide-react-native';
import type { Badge, StudentBadge } from '../types/database';

type IconComponent = typeof BookOpen;

export const BADGE_ICONS: Record<string, IconComponent> = {
  total_sessions: BookOpen,
  streak_days: Flame,
  quizzes_answered: MessageSquare,
  books_finished: Trophy,
  reflection_score_80: Brain,
  total_pages: Library,
  personal_book: Compass,
  avg_score_90_book: Target,
};

export function iconForCriteria(criteriaType: string): IconComponent {
  return BADGE_ICONS[criteriaType] ?? Award;
}

export interface BadgeStats {
  totalSessions: number;
  currentStreak: number;
  quizzesAnswered: number;
  booksFinished: number;
  totalPages: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
}

export function badgeProgress(badge: Badge, stats: BadgeStats): BadgeProgress | null {
  const atual: Record<string, number> = {
    total_sessions: stats.totalSessions,
    streak_days: stats.currentStreak,
    quizzes_answered: stats.quizzesAnswered,
    books_finished: stats.booksFinished,
    total_pages: stats.totalPages,
  };

  const current = atual[badge.criteria_type];
  if (current === undefined) return null;

  return { current: Math.min(current, badge.criteria_value), target: badge.criteria_value };
}

export type DecoratedBadge = Badge & {
  earned: boolean;
  earnedAt: string | null;
  progress: BadgeProgress | null;
};

export function decorateBadges(
  all: Badge[],
  earned: StudentBadge[],
  stats: BadgeStats,
): DecoratedBadge[] {
  const porId = new Map(earned.map((e) => [e.badge_id, e]));

  return all
    .map((badge) => {
      const ganha = porId.get(badge.id);
      return {
        ...badge,
        earned: Boolean(ganha),
        earnedAt: ganha?.earned_at ?? null,
        progress: ganha ? null : badgeProgress(badge, stats),
      };
    })
    .sort((a, b) => Number(b.earned) - Number(a.earned));
}
