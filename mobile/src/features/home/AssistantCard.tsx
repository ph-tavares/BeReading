// Card da Orelha na Hoje (spec S7.1, mockup 04): so aparece quando o
// chamador decidiu que ha assunto (quiz pendente, sequencia em risco ou
// livro parado). A fala (`text`) sempre vem de src/assistant/lines.ts; este
// componente e' so a composicao visual, sobre o primitivo Card (src/ui).
import { StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Text, Button, Card, Glyph } from '../../ui';
import { ASSISTANT_NAME } from '../../assistant/persona';
import { space } from '../../theme/tokens';

interface Props {
  text: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function AssistantCard({ text, ctaLabel, onPressCta }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.who}>
        {/* Tamanho padrao do Glyph (20): o mesmo do "who" do mockup, sem
            numero novo inventado. */}
        <Glyph />
        <Text variant="label" tone="accent">{ASSISTANT_NAME}</Text>
      </View>
      <Text variant="callout" tone="secondary">{text}</Text>
      {ctaLabel && onPressCta ? (
        <Button variant="ghost" size="md" icon={ArrowRight} onPress={onPressCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Card ja da fundo/borda/raio/padding (src/ui/Card.tsx); aqui so o
  // espacamento entre quem-fala, fala e cta.
  card: { gap: space.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
