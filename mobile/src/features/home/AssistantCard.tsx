// Card da Orelha na Hoje (spec S7.1, mockup 04): so aparece quando o
// chamador decidiu que ha assunto (quiz pendente, sequencia em risco ou
// livro parado). A fala (`text`) sempre vem de src/assistant/lines.ts; este
// componente e' so a composicao visual, sobre o primitivo Card (src/ui).
import { StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Text, Button, Card, Mascote } from '../../ui';
import { ASSISTANT_NAME } from '../../assistant/persona';
import { space } from '../../theme/tokens';

interface Props {
  text: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function AssistantCard({ text, ctaLabel, onPressCta }: Props) {
  return (
    <View style={styles.row}>
      {/* BER-120: o mascote saiu de dentro do card e virou quem apoia a fala.
          Tamanho `sm` (96), nao o `md` do mockup: num aparelho estreito o 134
          espremia a bolha. Ver Mascote.tsx para o porque de `size` ser nomeado. */}
      <Mascote size="sm" />
      <Card style={styles.card}>
        <Text variant="label" tone="brand">{ASSISTANT_NAME}</Text>
        <Text variant="callout" tone="secondary">{text}</Text>
        {ctaLabel && onPressCta ? (
          <Button variant="ghost" size="md" icon={ArrowRight} onPress={onPressCta}>
            {ctaLabel}
          </Button>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card ja da fundo/borda/raio/padding (src/ui/Card.tsx); aqui so o
  // espacamento entre quem-fala, fala e cta.
  card: { flex: 1, minWidth: 0, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
