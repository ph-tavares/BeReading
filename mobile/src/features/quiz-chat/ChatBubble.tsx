// Bolhas da conversa do quiz (spec 7.5). A Orelha fala a esquerda, sobre a
// superficie de card; o leitor fala a direita, em surface2. Sem borda lateral
// de destaque e sem sombra (DESIGN.md secao 9).
import { StyleSheet, View } from 'react-native';
import { Tag, Text } from '../../ui';
import { ASSISTANT_NAME } from '../../assistant/persona';
import { color, elevation, radius, space } from '../../theme/tokens';
import type { ChatMessage } from './logic';

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  switch (message.kind) {
    case 'reader':
      return (
        <View style={[styles.bolha, styles.leitor]}>
          <Text variant="body">{message.text}</Text>
        </View>
      );
    case 'typing':
      // Pontos estaticos por enquanto: a respiracao do Glyph e F7 (motion).
      return (
        <View
          testID="chat-typing"
          accessible
          accessibilityLabel={`${ASSISTANT_NAME} está escrevendo`}
          style={[styles.bolha, styles.orelha, styles.digitando]}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.ponto} />
          ))}
        </View>
      );
    case 'feedback':
      return (
        <View style={[styles.bolha, styles.orelha]}>
          <Text variant="callout">{message.text}</Text>
          {message.tag ? (
            <View style={styles.tag}>
              <Tag label={message.tag} tone="accent" />
            </View>
          ) : null}
        </View>
      );
    default:
      return (
        <View style={[styles.bolha, styles.orelha]}>
          {message.label ? <Text variant="caption" tone="accent">{message.label}</Text> : null}
          <Text variant={message.serif ? 'heading' : 'callout'} tone={message.serif ? 'primary' : 'secondary'}>
            {message.text}
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  bolha: { maxWidth: '88%', borderRadius: radius.card, padding: space.md, gap: space.xs },
  orelha: { ...elevation.surface, alignSelf: 'flex-start' },
  leitor: { backgroundColor: color.surface2, alignSelf: 'flex-end' },
  digitando: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  ponto: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.text3 },
  tag: { alignSelf: 'flex-start', marginTop: space.xs },
});
