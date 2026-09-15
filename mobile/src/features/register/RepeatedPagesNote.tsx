// Nota de paginas repetidas (BER-54), em accentSoft (spec S7.2): aparece antes
// do envio, acima do resumo.
//
// Composicao desta tela, nao primitivo: e o unico consumidor hoje. O Banner nao
// serve (duas variantes, danger e info, por contrato do DESIGN.md secao 5) e a
// Tag e rotulo curto, nao frase. Se uma segunda tela precisar de nota em
// accentSoft, isto vira peca de src/ui (mesmo raciocinio do Ruling F4-6).
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { color, radius, space } from '../../theme/tokens';

export function RepeatedPagesNote({ text }: { text: string }) {
  return (
    <View testID="nota-repetidas" style={styles.wrap}>
      <Text variant="callout">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.accentSoft,
    borderRadius: radius.control,
    padding: space.md,
  },
});
