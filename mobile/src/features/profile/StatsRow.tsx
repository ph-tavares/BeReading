// Tres numeros de Voce (spec 7.9): sequencia efetiva, paginas e media geral.
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui';
import { color, radius, space } from '../../theme/tokens';

interface Stat {
  value: string;
  label: string;
}

export function StatsRow({ items }: { items: Stat[] }) {
  return (
    <View style={styles.row}>
      {items.map((s) => (
        <View key={s.label} style={styles.item} accessible accessibilityLabel={`${s.value} ${s.label}`}>
          <Text variant="numericM">{s.value}</Text>
          <Text variant="caption" tone="secondary">{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  item: {
    flex: 1,
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    backgroundColor: color.surface1,
  },
});
