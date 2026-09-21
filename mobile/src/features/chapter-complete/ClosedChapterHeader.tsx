// Quem fala, o titulo e o convite pro quiz (spec S7.3, mockup 04). As falas
// chegam prontas de src/assistant/lines.ts; aqui e so a composicao.
import { StyleSheet, View } from 'react-native';
import { Mascote, Text } from '../../ui';
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
      {/* BER-120: aqui o mascote e' o assunto da tela, entao vai no maior
          tamanho nomeado. O nome continua embaixo: a ilustracao diz quem e',
          o rotulo diz como ele se chama. */}
      <Mascote size="lg" />
      <Text variant="label" tone="brand">{ASSISTANT_NAME}</Text>
      <Text variant="display" align="center" accessibilityRole="header">{title}</Text>
      {invite ? <Text variant="body" tone="secondary" align="center">{invite}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm },
});
