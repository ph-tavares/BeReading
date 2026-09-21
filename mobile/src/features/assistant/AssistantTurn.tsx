// Uma fala da conversa com o assistente (BER-101), no artboard `5. A conversa`.
//
// As duas vozes se distinguem por posicao e por superficie, nao por cor: a do leitor alinha a
// direita sobre `surface2`, a do assistente alinha a esquerda sobre `surface1` com o Glyph ao
// lado. Cor ficaria refem da direcao visual do momento; posicao nao.
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Glyph } from '../../assistant/Glyph';
import { color, radius, space } from '../../theme/tokens';
import type { ConversationTurn } from './logic';

interface Props {
  turn: ConversationTurn;
  /** Enquanto a resposta nao chegou, a fala do leitor fica apagada. */
  pendente?: boolean;
}

export function AssistantTurn({ turn, pendente = false }: Props) {
  if (turn.role === 'reader') {
    return (
      <View style={styles.doLeitor}>
        <View testID="fala-do-leitor" style={[styles.balaoDoLeitor, pendente ? styles.pendente : null]}>
          <Text variant="body">{turn.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.doAssistente}>
      <Glyph size={18} />
      <View testID="fala-do-assistente" style={styles.balaoDoAssistente}>
        <Text variant="body" tone="secondary">{turn.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doLeitor: { alignItems: 'flex-end' },
  balaoDoLeitor: {
    maxWidth: '85%',
    backgroundColor: color.surface2,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  // Sem opacidade no texto: o token `text3` ja e o apagado legivel, e opacidade
  // apagaria a borda junto (mesma regra do Button desabilitado).
  pendente: { backgroundColor: color.surface1 },

  doAssistente: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  balaoDoAssistente: {
    flex: 1,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
