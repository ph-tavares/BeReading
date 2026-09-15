// Resumo ao vivo do registro (spec S7.2, mockup 04): paginas, o aviso de
// capitulo que fecha e o XP previsto.
//
// Cor segue o DESIGN.md secao 1, nao o mockup: "ambar e jogo, neutro e
// leitura". O XP e camada de jogo (Tag em accent); fechar capitulo e progresso
// de leitura, entao o aviso fica em tinta neutra.
import { StyleSheet, View } from 'react-native';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Tag } from '../../ui/Tag';
import { space } from '../../theme/tokens';
import { formatXp } from '../../game/xp';

interface Props {
  /** `null` enquanto o intervalo nao e valido. */
  pages: number | null;
  xp: number | null;
  closingLabel: string | null;
}

export function ReadingSummary({ pages, xp, closingLabel }: Props) {
  return (
    <Card style={styles.card}>
      <Text variant="numericL" tone={pages === null ? 'tertiary' : 'primary'}>{String(pages ?? 0)}</Text>
      <View style={styles.meta}>
        <Text variant="caption" tone="secondary">{pages === 1 ? 'página' : 'páginas'}</Text>
        {closingLabel ? <Text variant="label">{closingLabel}</Text> : null}
      </View>
      {xp !== null ? (
        <View>
          <Tag label={`+${formatXp(xp)} XP`} tone="accent" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flex: 1 },
});
