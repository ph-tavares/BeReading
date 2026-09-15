// Carregamento da conquista (F4-15): skeleton no formato da tela, nunca
// spinner. So os capitulos carregam (o XP ja esta no store), e sem eles nao ha
// titulo nem quiz pra abrir. Blocos, na ordem real: quem fala, titulo,
// convite, anel, tags e os botoes, na mesma moldura da tela pronta.
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { radius, space, type as typeTokens } from '../../theme/tokens';
import { chapterCompleteLayout } from './layout';
import { RING_SIZE } from './XpRing';

const BUTTON_HEIGHT = 50; // Altura de Button size="lg" (src/ui/Button.tsx).
// Tag: uma linha de legenda mais o padding vertical dela (src/ui/Tag.tsx).
const TAG_HEIGHT = typeTokens.caption.lineHeight + space.xs * 2;

interface Props {
  /**
   * O que ja funciona enquanto carrega: o "Depois" (F4-26). Sair nao depende
   * dos capitulos, e a consulta nao tem timeout.
   */
  children: React.ReactNode;
}

export function ChapterCompleteSkeleton({ children }: Props) {
  // As larguras sao aproximadas: comprimento de texto que ainda nao chegou.
  return (
    <>
      <View style={chapterCompleteLayout.corpo}>
        <View style={styles.cabecalho}>
          <Skeleton width={72} height={typeTokens.label.lineHeight} />
          <Skeleton width={220} height={typeTokens.display.lineHeight} />
          <Skeleton width={180} height={typeTokens.body.lineHeight} />
        </View>
        <Skeleton width={RING_SIZE} height={RING_SIZE} borderRadius={radius.pill} />
        <View style={styles.tags}>
          <Skeleton width={72} height={TAG_HEIGHT} />
          <Skeleton width={120} height={TAG_HEIGHT} />
        </View>
      </View>
      <View style={chapterCompleteLayout.acoes}>
        {/* So o "Bora pro quiz" espera: ele depende de saber qual capitulo abrir. */}
        <Skeleton width="100%" height={BUTTON_HEIGHT} borderRadius={radius.control} />
        {children}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cabecalho: { alignItems: 'center', gap: space.sm },
  tags: { flexDirection: 'row', gap: space.sm },
});
