import { View, Text, StyleSheet } from 'react-native';
import { groupSessionsByDay } from '../utils/chartUtils';
import type { ReadingSession } from '../types/database';

interface Props {
  sessions: ReadingSession[];
}

export function PagesChart({ sessions }: Props) {
  const days = groupSessionsByDay(sessions, 14);
  const maxPages = Math.max(...days.map(d => d.pages), 1);

  return (
    <View>
      {/* Barras */}
      <View style={styles.chartArea}>
        {days.map((day) => {
          const heightPct = day.pages > 0 ? (day.pages / maxPages) * 100 : 0;
          return (
            <View key={day.dateStr} style={styles.barColumn}>
              <View style={styles.barTrack}>
                {heightPct > 0 && (
                  <View
                    style={[
                      styles.bar,
                      { height: `${heightPct}%` as `${number}%` },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Labels */}
      <View style={styles.labelsRow}>
        {days.map((day, i) => {
          const showLabel = i === 0 || i === 6 || i === 13;
          return (
            <View key={day.dateStr} style={styles.labelCell}>
              {showLabel && (
                <Text style={styles.labelText} numberOfLines={1}>
                  {day.label}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 3,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: '#F59E0B',
    borderRadius: 3,
    minHeight: 3,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 3,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
