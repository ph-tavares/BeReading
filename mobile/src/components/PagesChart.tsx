import { View, Text } from 'react-native';
import { groupSessionsByDay } from '../utils/chartUtils';
import { colors, fonts } from '../theme/tokens';
import type { ReadingSession } from '../types/database';

interface Props {
  sessions: ReadingSession[];
}

export function PagesChart({ sessions }: Props) {
  const days = groupSessionsByDay(sessions, 14);
  const maxPages = Math.max(...days.map((d) => d.pages), 1);

  return (
    <View>
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 80,
        gap: 4,
      }}>
        {days.map((day, i) => {
          const isToday = i === days.length - 1;
          const hasPages = day.pages > 0;
          const heightPct = hasPages ? (day.pages / maxPages) * 90 + 10 : 5;
          return (
            <View key={day.dateStr} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{
                width: '100%',
                height: `${heightPct}%`,
                backgroundColor: !hasPages
                  ? colors.surface
                  : isToday
                    ? colors.flame
                    : colors.green,
                borderRadius: 4,
                borderBottomWidth: hasPages ? 3 : 0,
                borderBottomColor: isToday ? colors.flameDeep : colors.greenDeep,
                shadowColor: isToday && hasPages ? colors.flame : 'transparent',
                shadowOpacity: isToday && hasPages ? 0.4 : 0,
                shadowOffset: { width: 0, height: 0 },
                shadowRadius: 12,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
      }}>
        <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: colors.textMute }}>
          2 sem atrás
        </Text>
        <Text style={{ fontFamily: fonts.black, fontSize: 10, color: colors.flame }}>
          hoje
        </Text>
      </View>
    </View>
  );
}
