import { StyleSheet, View } from 'react-native';
import { Text, TONE_COLOR, type Tone } from './Text';
import { color, radius, space } from '../theme/tokens';

export type TagTone = 'neutral' | 'accent' | 'positive' | 'danger';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  label: string;
  tone?: TagTone;
  icon?: IconCmp;
}

// Tag precisa de fundo solido, nao so tinta de texto (diferente do Tone de
// Text.tsx), entao cada tom aqui e um par fundo mais tom de texto. Reusa os
// pares macio/solido que ja existem em tokens (accentSoft/accent,
// positiveSoft/positive, dangerSoft/danger) em vez de inventar um quinto
// vocabulario de nomes. O neutro nao tem par soft/solid dedicado: escolhe
// surface2 (um degrau acima da superficie base, contraste suficiente sem
// virar acento) e secondary (o mesmo tom que o resto do sistema usa para
// informacao de apoio, nao a informacao principal da tela).
const TAG_TONE: Record<TagTone, { bg: string; textTone: Tone }> = {
  neutral: { bg: color.surface2, textTone: 'secondary' },
  accent: { bg: color.accentSoft, textTone: 'accent' },
  positive: { bg: color.positiveSoft, textTone: 'positive' },
  danger: { bg: color.dangerSoft, textTone: 'danger' },
};

// Estatico de proposito: sem Pressable, sem onPress, sem accessibilityRole.
// O Chip existente exige onPress e vira botao na arvore de acessibilidade;
// usa-lo com uma funcao vazia poria um botao falso para quem usa leitor de
// tela. Tag existe para os quatro lugares que so mostram informacao (XP,
// sequencia de dias, nota do quiz, genero e paginas do livro), sem acao
// nenhuma por tras.
export function Tag({ label, tone = 'neutral', icon: Icon }: Props) {
  const t = TAG_TONE[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      {Icon ? (
        // Decorativo: o texto ao lado ja carrega o significado, entao o
        // icone nao pode virar um segundo no anunciavel para o leitor de
        // tela (mesmo tratamento do Glyph em src/assistant/Glyph.tsx).
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon size={12} color={TONE_COLOR[t.textTone]} strokeWidth={2.2} />
        </View>
      ) : null}
      <Text variant="caption" tone={t.textTone}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.tag,
  },
});
