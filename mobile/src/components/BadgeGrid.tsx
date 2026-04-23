import { View, Text } from 'react-native';
import { BookOpen, Flame, Trophy, PenLine, MessageSquare, Target, Lock } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { colors, fonts, radii } from '../theme/tokens';
import type { Badge, StudentBadge } from '../types/database';

interface Props {
  allBadges: Badge[];
  earnedBadges: (StudentBadge & { badge: Badge })[];
}

const ICON_MAP: Record<string, ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  pages_read: BookOpen,
  streak_days: Flame,
  books_finished: Trophy,
  quizzes_completed: PenLine,
  answers_submitted: MessageSquare,
};

function iconFor(criteriaType: string): ComponentType<{ size: number; color: string; strokeWidth?: number }> {
  return ICON_MAP[criteriaType] ?? Target;
}

export function BadgeGrid({ allBadges, earnedBadges }: Props) {
  const earnedIds = new Set(earnedBadges.map((sb) => sb.badge_id));

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {allBadges.map((badge) => {
        const earned = earnedIds.has(badge.id);
        const Icon = earned ? iconFor(badge.criteria_type) : Lock;
        return (
          <View
            key={badge.id}
            style={{
              width: '31.5%',
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: earned ? 'rgba(250,204,21,0.08)' : colors.bgSunk,
              borderWidth: 1,
              borderStyle: earned ? 'solid' : 'dashed',
              borderColor: earned ? 'rgba(250,204,21,0.33)' : colors.hairline,
              alignItems: 'center',
              gap: 6,
              opacity: earned ? 1 : 0.5,
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: earned ? colors.gold : colors.surface,
              borderBottomWidth: earned ? 3 : 0,
              borderBottomColor: colors.goldDeep,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon size={16} color={earned ? '#fff' : colors.textMute} strokeWidth={2.2} />
            </View>
            <Text numberOfLines={2} style={{
              fontFamily: fonts.bold,
              fontSize: 9.5,
              color: earned ? colors.text : colors.textMute,
              textAlign: 'center',
              lineHeight: 11,
            }}>{badge.name}</Text>
          </View>
        );
      })}
    </View>
  );
}
