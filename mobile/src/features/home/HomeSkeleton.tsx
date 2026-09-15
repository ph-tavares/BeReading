// Carregamento da Hoje: skeleton no formato exato da tela, nunca spinner
// (DESIGN.md secao 5 e 9). Blocos, na ordem real: cabecalho (saudacao +
// anel) -> semana -> hero do livro -> botao primario -> card do assistente
// (bloco condicional; o skeleton nao sabe ainda se vai haver assunto, entao
// reserva o espaco no formato de Card por seguranca) -> rodape de nivel/XP.
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { radius, space, type as typeTokens } from '../../theme/tokens';

const RING_SIZE = 38; // Documentado em src/ui/Ring.tsx: 38 na Hoje.
const COVER_WIDTH = 86; // Documentado em src/ui/Cover.tsx: 86 na Hoje.
const COVER_HEIGHT = Math.round(COVER_WIDTH * 1.5); // Mesma proporcao 2:3 do Cover.
const PROGRESS_HEIGHT = 4; // Altura default de src/ui/ProgressBar.tsx.
const BUTTON_HEIGHT = 50; // Altura de Button size="lg" (src/ui/Button.tsx).
const WEEK_MARKER = space.xxl; // Mesmo diametro do marcador real (StreakWeek.tsx).
const CARD_HEIGHT = 90; // Aproximacao de um AssistantCard tipico (glyph + 2 linhas + cta).

// Alturas de linha de texto: as mesmas variantes de `type` que os
// componentes reais usam (HomeHeader.kicker=label, HomeHeader.nome=title,
// CurrentBookHero.autor/meta=caption, CurrentBookHero.titulo=heading), nao
// numero solto. As LARGURAS continuam aproximadas: sao comprimento de texto
// que ainda nao existe (nome, titulo, autor variam por leitor e livro), e
// nao ha token de "largura de linha" pra isso — mesma pratica de qualquer
// skeleton de texto.
const KICKER_HEIGHT = typeTokens.label.lineHeight;
const TITLE_HEIGHT = typeTokens.title.lineHeight;
const HERO_TITLE_HEIGHT = typeTokens.heading.lineHeight;
const CAPTION_HEIGHT = typeTokens.caption.lineHeight;

export function HomeSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ gap: space.xs }}>
          <Skeleton width={48} height={KICKER_HEIGHT} />
          <Skeleton width={140} height={TITLE_HEIGHT} />
        </View>
        <Skeleton width={RING_SIZE} height={RING_SIZE} borderRadius={radius.pill} />
      </View>

      <View style={styles.week}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} width={WEEK_MARKER} height={WEEK_MARKER} borderRadius={radius.pill} />
        ))}
      </View>

      <View style={styles.hero}>
        <Skeleton width={COVER_WIDTH} height={COVER_HEIGHT} borderRadius={radius.tag} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton width={90} height={CAPTION_HEIGHT} />
          <Skeleton width="100%" height={HERO_TITLE_HEIGHT} />
          <Skeleton width={120} height={CAPTION_HEIGHT} />
          <Skeleton width="100%" height={PROGRESS_HEIGHT} borderRadius={PROGRESS_HEIGHT / 2} />
        </View>
      </View>

      <Skeleton width="100%" height={BUTTON_HEIGHT} borderRadius={radius.control} />
      <Skeleton width="100%" height={CARD_HEIGHT} borderRadius={radius.card} />

      <View style={styles.footer}>
        <Skeleton width={100} height={CAPTION_HEIGHT} />
        <Skeleton width={80} height={CAPTION_HEIGHT} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', gap: space.md },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
});
