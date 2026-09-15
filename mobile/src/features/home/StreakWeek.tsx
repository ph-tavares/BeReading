// Semana de sequencia + frase (spec S7.1, mockup 04): sete marcadores, um por
// dia da semana corrente, e a frase que vem de src/assistant/lines.ts (o
// chamador monta o texto; este componente so exibe).
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../../ui/Text';
import { color, space, radius } from '../../theme/tokens';
import type { WeekDay } from '../../game/streak';

interface Props {
  days: WeekDay[];
  streakText: string;
}

// Sem alvo de toque (o marcador nao e' tocavel): o diametro vem de space.xxl,
// nao de um numero derivado do mockup (ADR 0010) nem de MIN_TOUCH, que e'
// regra de alvo tocavel e nao se aplica aqui.
const MARKER = space.xxl;

export function StreakWeek({ days, streakText }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {days.map((dia) => (
          <View key={dia.date} style={styles.day} testID={dia.isToday ? 'week-day-today' : undefined}>
            <View
              testID={`week-marker-${dia.date}`}
              style={[
                styles.marker,
                dia.read ? styles.markerRead : null,
                dia.isToday && !dia.read ? styles.markerToday : null,
              ]}
            >
              {/* Mesmo tamanho e traco do icone de Tag.tsx (12, 2.2): nao o
                  pixel do mockup (ADR 0010), o precedente ja revisado para
                  icone pequeno sobre selo colorido. */}
              {dia.read ? <Check size={12} color={color.accentInk} strokeWidth={2.2} /> : null}
            </View>
            <Text variant="caption" tone={dia.isToday ? 'accent' : 'tertiary'}>{dia.letter}</Text>
          </View>
        ))}
      </View>
      <Text variant="callout" tone="secondary">{streakText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: space.xs },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: radius.pill,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRead: { backgroundColor: color.accent, borderColor: color.accent },
  markerToday: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: color.accent },
});
