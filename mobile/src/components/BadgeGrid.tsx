import { View, Text, StyleSheet } from 'react-native';
import type { Badge, StudentBadge } from '../types/database';

interface Props {
  allBadges: Badge[];
  earnedBadges: (StudentBadge & { badge: Badge })[];
}

const CRITERIA_EMOJI: Record<string, string> = {
  pages_read: '📖',
  streak_days: '🔥',
  books_finished: '🏆',
  quizzes_completed: '✍️',
  answers_submitted: '💬',
};

function getBadgeEmoji(criteriaType: string): string {
  return CRITERIA_EMOJI[criteriaType] ?? '🎯';
}

export function BadgeGrid({ allBadges, earnedBadges }: Props) {
  const earnedIds = new Set(earnedBadges.map(sb => sb.badge_id));

  return (
    <View style={styles.grid}>
      {allBadges.map(badge => {
        const earned = earnedIds.has(badge.id);
        return (
          <View
            key={badge.id}
            style={[styles.cell, earned ? styles.cellEarned : styles.cellLocked]}
          >
            <Text style={styles.emoji}>
              {earned ? getBadgeEmoji(badge.criteria_type) : '🔒'}
            </Text>
            <Text
              style={[styles.name, earned ? styles.nameEarned : styles.nameLocked]}
              numberOfLines={2}
            >
              {badge.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '30%',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  cellEarned: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  cellLocked: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emoji: {
    fontSize: 24,
  },
  name: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  nameEarned: {
    color: '#4338CA',
  },
  nameLocked: {
    color: '#D1D5DB',
  },
});
