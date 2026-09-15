// Cartao de plano (spec adendo 15/09, DESIGN.md secao 10). Premium nao tem cor
// propria: sem coroa, sem dourado. Preco em numericL com a cor de texto; o
// plano atual ganha a Tag "Seu plano".
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Card, Tag, Text } from '../../ui';
import { color, space } from '../../theme/tokens';

interface Props {
  name: string;
  price: string;
  period?: string;
  features: string[];
  current: boolean;
  /** O plano oferecido: borda um tom acima, nunca cor de marca. */
  highlight?: boolean;
}

export function PlanOption({ name, price, period, features, current, highlight = false }: Props) {
  return (
    <Card style={highlight ? styles.destaque : undefined}>
      <View style={styles.corpo}>
        <View style={styles.topo}>
          <Text variant="subhead">{name}</Text>
          {current ? <Tag label="Seu plano" tone="accent" /> : null}
        </View>
        <View style={styles.preco}>
          <Text variant="numericL">{price}</Text>
          {period ? <Text variant="callout" tone="tertiary">{period}</Text> : null}
        </View>
        <View style={styles.lista}>
          {features.map((f) => (
            <View key={f} style={styles.item}>
              <Check size={16} color={color.positive} strokeWidth={2.4} />
              <Text variant="callout" tone="secondary" style={styles.texto}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  destaque: { borderWidth: 1, borderColor: color.line2 },
  corpo: { gap: space.md },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  preco: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  lista: { gap: space.sm },
  item: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  texto: { flex: 1 },
});
