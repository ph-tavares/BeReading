// Composer da conversa do quiz (spec 7.5): cresce ate 5 linhas e o Enviar fica
// desabilitado sem texto. Enquanto a IA avalia, o campo trava e o botao mostra
// carregamento, sem sumir.
import { StyleSheet, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { Button } from '../../ui';
import { color, radius, space, type as typeTokens } from '../../theme/tokens';

// A variante body, a mesma que um Text usaria. O teto de Dynamic Type vai como
// prop do TextInput, e nao dentro do estilo.
const { maxFontSizeMultiplier: TETO, ...ESTILO_DO_TEXTO } = typeTokens.body;

// Cinco linhas de body mais o respiro interno do campo.
const ALTURA_MAXIMA = typeTokens.body.lineHeight * 5 + space.md * 2;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
}

export function Composer({ value, onChangeText, onSend, sending }: Props) {
  const vazio = value.trim().length === 0;

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        editable={!sending}
        placeholder="Escreve com suas palavras"
        placeholderTextColor={color.text3}
        accessibilityLabel="Sua resposta"
        maxFontSizeMultiplier={TETO}
        textAlignVertical="top"
        style={styles.campo}
      />
      <Button icon={Send} onPress={onSend} disabled={vazio} loading={sending}>Enviar</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  campo: {
    ...ESTILO_DO_TEXTO,
    color: color.text,
    backgroundColor: color.surface2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxHeight: ALTURA_MAXIMA,
  },
});
