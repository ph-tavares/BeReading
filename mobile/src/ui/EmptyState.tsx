import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { space, COVER_PALETTE_COLORS } from '../theme/tokens';

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Segunda saida, mais discreta (ghost): "Voltar pro livro", "Agora não". */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /**
   * `'spines'` (padrao): lombadas de livro, para vazio de verdade.
   * `'none'`: sem ilustracao, para estado que nao e vazio (erro de perfil, sucesso).
   * Elemento: ilustracao propria, como o Glyph do assistente nos estados do quiz.
   */
  illustration?: 'spines' | 'none' | React.ReactElement;
}

// A ilustracao padrao e feita com as pecas do proprio sistema (lombadas de
// livro), sem mascote e sem emoji: o estado vazio continua sendo do mesmo produto.
export function EmptyState({
  title, description, actionLabel, onAction, secondaryLabel, onSecondary, illustration = 'spines',
}: Props) {
  const temAcao = Boolean(actionLabel && onAction);
  const temSecundaria = Boolean(secondaryLabel && onSecondary);

  return (
    <View style={styles.wrap}>
      {illustration === 'spines' ? (
        <View testID="empty-spines" style={styles.spines} pointerEvents="none">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.spine,
                { backgroundColor: COVER_PALETTE_COLORS[i], height: i === 1 ? 68 : 56, opacity: 0.5 },
              ]}
            />
          ))}
        </View>
      ) : illustration === 'none' ? null : (
        <View style={styles.illustration}>{illustration}</View>
      )}
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="callout" tone="secondary" align="center" style={styles.desc}>{description}</Text>
      {temAcao || temSecundaria ? (
        <View style={styles.actions}>
          {temAcao ? <Button onPress={onAction!}>{actionLabel!}</Button> : null}
          {temSecundaria ? <Button variant="ghost" onPress={onSecondary!}>{secondaryLabel!}</Button> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.gutter },
  spines: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, marginBottom: space.xl },
  spine: { width: 16, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  illustration: { marginBottom: space.xl },
  desc: { marginTop: space.sm, maxWidth: 280 },
  actions: { marginTop: space.xl, minWidth: 200, gap: space.sm },
});
