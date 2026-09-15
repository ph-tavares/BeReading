import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, space, MIN_TOUCH } from '../theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Acao que nao se desfaz (excluir conta, sair): titulo na cor de perigo. */
  tone?: 'default' | 'destructive';
  /** Acao em andamento: indicador no lugar do trailing, sem novo toque. */
  loading?: boolean;
  accessibilityLabel?: string;
  /** Ultima linha da lista: sem divisoria embaixo. */
  last?: boolean;
}

// Lista com divisoria, nao card: nem tudo precisa virar caixa com sombra. O card
// fica para o que e tocavel E isolado.
export function ListRow({
  title, subtitle, leading, trailing, onPress, disabled = false, tone = 'default',
  loading = false, accessibilityLabel, last = false,
}: Props) {
  const inativo = disabled || loading;
  const tomTitulo = disabled ? 'secondary' : tone === 'destructive' ? 'danger' : 'primary';

  const conteudo = (
    <View style={[styles.row, last ? null : styles.divider]}>
      {leading}
      <View style={styles.texts}>
        <Text variant="subhead" tone={tomTitulo} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {loading ? <ActivityIndicator testID="list-row-loading" size="small" color={color.text2} /> : trailing}
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inativo, busy: loading }}
      onPress={inativo ? undefined : onPress}
      disabled={inativo}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TOUCH + 8,
    paddingVertical: space.md,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { backgroundColor: color.surface1 },
});
