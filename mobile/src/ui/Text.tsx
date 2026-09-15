import { Text as RNText, StyleSheet, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { type as typeTokens, color, type TypeVariant } from '../theme/tokens';

export type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'danger' | 'inverse';

// Exportado para outros primitivos (ex.: Button) pintarem icone exatamente na
// mesma cor do tone do texto ao lado, sem duplicar a tabela.
export const TONE_COLOR: Record<Tone, string> = {
  primary: color.text,
  secondary: color.text2,
  tertiary: color.text3,
  accent: color.accent,
  positive: color.positive,
  danger: color.danger,
  inverse: color.accentInk,
};

// Tone e Status sao dois tipos, de proposito, e nao um so. Tone e papel de
// cor: qual tinta o texto usa. Status e estado do produto: deu certo, deu
// errado, e so um aviso. Fundir os dois faria um valor sem sentido compilar
// em qualquer lugar que aceite o outro (por exemplo, <Banner tone="inverse">,
// que nao quer dizer nada). As palavras coincidem de proposito nos dois onde
// o papel e o mesmo (positive, danger): usar o mesmo nome nos dois lados e o
// que fecha a divergencia que a revisao da F2 apontou (danger num componente,
// error noutro; positive e success).
export type Status = 'positive' | 'danger' | 'info';

// Traduz estado para o tone de texto que combina com ele. "info" pinta como
// texto secundario porque aviso neutro nao tem tinta propria no sistema.
export const STATUS_TONE: Record<Status, Tone> = {
  positive: 'positive',
  danger: 'danger',
  info: 'secondary',
};

interface Props extends Omit<TextProps, 'style' | 'maxFontSizeMultiplier'> {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

// Um Text so, por variante. E o que encerra os 26 tamanhos de fonte soltos do
// app antigo: quem precisa de um tamanho novo acrescenta variante no token, e a
// guarda de __tests__/guards barra fontSize literal em tela.
export function Text({ variant = 'body', tone = 'primary', align, style, children, ...rest }: Props) {
  const t = typeTokens[variant];
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      style={[styles[variant], { color: TONE_COLOR[tone] }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  );
}

// StyleSheet.create em vez de objeto inline: a plataforma registra o estilo
// uma vez e o reusa por id nas renderizações seguintes, em vez de comparar o
// objeto inteiro a cada uma.
const styles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(typeTokens).map(([k, v]) => {
      const { maxFontSizeMultiplier: _teto, ...textStyle } = v;
      return [k, textStyle];
    }),
    // O cast abaixo e seguro: `type` em tokens.ts ja e anotado como
    // Record<TypeVariant, TypeStyle>, entao o compilador garante la que toda
    // variante tem entrada e nao ha entrada a mais. O `as` so recupera a
    // uniao literal de chaves que Object.fromEntries descarta.
  ) as Record<TypeVariant, TextStyle>,
);
