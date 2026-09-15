// Topo do login (spec 7.10): estante de lombadas na paleta das capas, o
// marcador e o wordmark em Newsreader. Sem mascote: a marca e o livro.
import { StyleSheet, View } from 'react-native';
import { Glyph, Text } from '../../ui';
import { COVER_PALETTE_COLORS, color, space } from '../../theme/tokens';

// Alturas desencontradas de proposito: estante de verdade nao e grafico de barras.
const ALTURAS = [64, 82, 56, 90, 70, 60, 86, 68];

export function AuthHero() {
  return (
    <View style={styles.wrap}>
      <View testID="auth-spines" style={styles.estante} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {COVER_PALETTE_COLORS.map((cor, i) => (
          <View key={cor} style={[styles.lombada, { backgroundColor: cor, height: ALTURAS[i] }]} />
        ))}
      </View>
      <View style={styles.prateleira} />
      <View style={styles.marca} accessible accessibilityRole="header" accessibilityLabel="BeReading">
        <Glyph size={28} />
        <Text variant="display">BeReading</Text>
      </View>
      <Text variant="body" tone="secondary">Você lê. A gente te faz pensar sobre o que leu.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingTop: space.xl },
  estante: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  lombada: { width: 18, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  prateleira: { height: 2, backgroundColor: color.line2, marginTop: -space.md },
  marca: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
});
