import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from '../theme/tokens';

interface Props {
  label: string;
  selected?: boolean;
  /**
   * Sem toque, rotulo apagado e anunciado como desabilitado (DESIGN.md secao
   * 5). Nasceu para o sheet de registro travar os atalhos enquanto envia.
   */
  disabled?: boolean;
  onPress: () => void;
}

// O chip antigo pintava borda e texto com a cor da categoria, o que colocava
// seis acentos na mesma tela. Aqui o selecionado inverte (tinta clara, texto
// escuro): destaca sem gastar cor nova.
export function Chip({ label, selected = false, disabled = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6 }}
      // Desabilitado nao inverte nem quando selecionado: texto apagado sobre a
      // tinta clara ficaria ilegivel. A selecao continua no accessibilityState.
      style={[styles.base, disabled ? styles.inativo : selected ? styles.on : styles.off]}
    >
      <Text variant="callout" tone={disabled ? 'tertiary' : selected ? 'inverse' : 'secondary'}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 34,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  on: { backgroundColor: color.text, borderColor: color.text },
  off: { backgroundColor: 'transparent', borderColor: color.line2 },
  inativo: { backgroundColor: 'transparent', borderColor: color.line },
});
