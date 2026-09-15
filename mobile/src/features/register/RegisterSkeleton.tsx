// Carregamento do sheet: skeleton no formato do conteudo, nunca spinner
// (DESIGN.md secoes 5 e 9). Blocos na ordem real: titulo, linha do livro,
// campos, atalhos, resumo e CTA.
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { radius, space, type as typeTokens } from '../../theme/tokens';

const COVER_XS = 48; // Cover size="xs" (src/ui/Cover.tsx).
const COVER_XS_HEIGHT = Math.round(COVER_XS * 1.5); // Mesma proporcao 2:3 do Cover.
const FIELD_HEIGHT = 72; // Caixa do PageField (src/ui/PageField.tsx).
const CHIP_HEIGHT = 34; // Altura do Chip (src/ui/Chip.tsx).
const BUTTON_HEIGHT = 50; // Button size="lg" (src/ui/Button.tsx).
const SUMMARY_HEIGHT = typeTokens.numericL.lineHeight + space.lg * 2; // Card com padding lg.

export function RegisterSkeleton() {
  return (
    <View style={styles.wrap}>
      <Skeleton width={200} height={typeTokens.title.lineHeight} />

      <View style={styles.row}>
        <Skeleton width={COVER_XS} height={COVER_XS_HEIGHT} borderRadius={radius.tag} />
        <View style={styles.texts}>
          <Skeleton width="80%" height={typeTokens.subhead.lineHeight} />
          <Skeleton width={100} height={typeTokens.caption.lineHeight} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Skeleton width="100%" height={FIELD_HEIGHT} borderRadius={radius.card} />
        </View>
        <View style={styles.col}>
          <Skeleton width="100%" height={FIELD_HEIGHT} borderRadius={radius.card} />
        </View>
      </View>

      <View style={styles.chips}>
        <Skeleton width={56} height={CHIP_HEIGHT} borderRadius={radius.pill} />
        <Skeleton width={56} height={CHIP_HEIGHT} borderRadius={radius.pill} />
        <Skeleton width={140} height={CHIP_HEIGHT} borderRadius={radius.pill} />
      </View>

      <Skeleton width="100%" height={SUMMARY_HEIGHT} borderRadius={radius.card} />
      <Skeleton width="100%" height={BUTTON_HEIGHT} borderRadius={radius.control} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  texts: { flex: 1, gap: space.sm },
  col: { flex: 1 },
  chips: { flexDirection: 'row', gap: space.sm },
});
