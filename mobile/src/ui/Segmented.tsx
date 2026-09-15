import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space, MIN_TOUCH } from '../theme/tokens';

export interface SegmentedOption {
  value: string;
  label: string;
}

interface Props {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Segmented({ options, value, onChange }: Props) {
  return (
    <View accessibilityRole="tablist" style={styles.wrap}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            // Tocar no que ja esta ativo nao deve recarregar a lista.
            onPress={selected ? undefined : () => onChange(o.value)}
            style={[styles.item, selected ? styles.on : null]}
          >
            <Text variant="label" tone={selected ? 'primary' : 'secondary'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.chip + 1,
    padding: 3,
  },
  item: {
    flex: 1,
    // O 34 do mockup vem de uma tela desenhada a ~0.75 da escala real: aqui
    // o alvo tem que ser o MIN_TOUCH de verdade, nao o valor do desenho.
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip - 2,
    paddingHorizontal: space.sm,
  },
  on: { backgroundColor: color.surface3 },
});
