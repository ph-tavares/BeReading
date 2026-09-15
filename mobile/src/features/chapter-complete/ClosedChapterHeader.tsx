// Quem fala, o titulo e o convite pro quiz (spec S7.3, mockup 04). As falas
// chegam prontas de src/assistant/lines.ts; aqui e so a composicao.
import { StyleSheet, View } from 'react-native';
import { Glyph, Text } from '../../ui';
import { ASSISTANT_NAME } from '../../assistant/persona';
import { space } from '../../theme/tokens';

interface Props {
  title: string;
  /** `null` quando nao ha quiz pra abrir. */
  invite: string | null;
}

export function ClosedChapterHeader({ title, invite }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.who}>
        {/* Tamanho padrao do Glyph, o mesmo do AssistantCard da Hoje. */}
        <Glyph />
        <Text variant="label" tone="accent">{ASSISTANT_NAME}</Text>
      </View>
      <Text variant="display" align="center" accessibilityRole="header">{title}</Text>
      {invite ? <Text variant="body" tone="secondary" align="center">{invite}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
});
