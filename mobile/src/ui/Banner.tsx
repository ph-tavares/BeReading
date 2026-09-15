import { Pressable, StyleSheet, View } from 'react-native';
import { Text, STATUS_TONE, type Status } from './Text';
import { color, radius, space } from '../theme/tokens';

/**
 * Duas variantes, nao tres (DESIGN.md secao 5). O Banner usa o vocabulario de
 * `Status`, mas nao os tres valores dele: `positive` fica de fora de proposito.
 *
 * O motivo esta na propria regra de saida do componente: o Banner e persistente,
 * "some quando a causa e corrigida". Sucesso nao tem causa a corrigir. Um banner
 * verde seria o unico elemento do sistema sem regra coerente de quando sair.
 * Sucesso e transitorio, e transitorio e Toast.
 */
export type BannerTone = Exclude<Status, 'positive'>;

interface Props {
  tone: BannerTone;
  message: string;
  onRetry?: () => void;
}

// Fundo e borda por estado, no mesmo par macio/solido do resto do sistema
// (dangerSoft/danger). "info" nao e alerta, entao fica na superficie neutra em
// vez de um par soft/solid proprio.
const BANNER_TONE: Record<BannerTone, { bg: string; border: string }> = {
  danger: { bg: color.dangerSoft, border: color.danger },
  info: { bg: color.surface1, border: color.line },
};

// Erro que nao derruba a tela: o que ja carregou continua visivel e o banner
// explica o resto. Substitui o Alert.alert, que tapa a tela e some sem rastro.
export function Banner({ tone, message, onRetry }: Props) {
  const t = BANNER_TONE[tone];
  return (
    <View
      accessible
      accessibilityRole="alert"
      // Mesma razao do Toast: accessibilityRole="alert" sozinho nao e
      // anunciado no TalkBack, so com accessibilityLiveRegion="polite" junto.
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <Text variant="callout" tone={STATUS_TONE[tone]} style={styles.msg}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tentar de novo" onPress={onRetry} hitSlop={8}>
          <Text variant="label" tone="accent">Tentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  msg: { flex: 1 },
});
