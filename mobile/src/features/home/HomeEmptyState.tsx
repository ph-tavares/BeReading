// Primeiro acesso (sem livro nenhum): a Orelha se apresenta em vez de um
// EmptyState generico (spec S7.1, mockup 04, secao "Primeiro acesso"). O
// texto de apresentacao vem de src/assistant/persona.ts (ASSISTANT_INTRO),
// a mesma constante que qualquer outra apresentacao da Orelha usaria.
import { StyleSheet, View } from 'react-native';
import { Text, Button, Glyph } from '../../ui';
import { ASSISTANT_NAME, ASSISTANT_INTRO } from '../../assistant/persona';
import { space } from '../../theme/tokens';

interface Props {
  onExplore: () => void;
}

export function HomeEmptyState({ onExplore }: Props) {
  return (
    <View style={styles.wrap}>
      {/* Mesmo tamanho que app/chapter-complete.tsx usa para a Orelha centrada
          e em destaque (40): reaproveita o precedente em vez de outro numero. */}
      <Glyph size={40} />
      <Text variant="label" tone="accent">{ASSISTANT_NAME}</Text>
      <Text variant="body" tone="secondary" align="center" style={styles.intro}>
        {ASSISTANT_INTRO}
      </Text>
      <View style={styles.action}>
        <Button onPress={onExplore}>Ver catálogo</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxl, gap: space.sm },
  // 280/200: mesmos limites de largura que src/ui/EmptyState.tsx ja usa para
  // texto e acao centralizados, nao numero novo.
  intro: { maxWidth: 280, marginTop: space.xs },
  action: { marginTop: space.lg, minWidth: 200 },
});
