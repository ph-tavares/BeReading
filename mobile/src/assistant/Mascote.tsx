// O mascote do assistente (BER-120). Ilustracao, nao icone.
//
// Ele NAO substitui o Glyph. O Glyph e' a marca pequena que diz "quem esta
// falando" ao lado de um rotulo, e roda a 20, 28 e 40px em nove lugares; o
// mascote e' o desenho grande, que aparece onde ha espaco para ele existir —
// a bolha do assistente na Hoje e a tela de capitulo fechado.
//
// `size` e' um conjunto nomeado, nao um numero, de proposito: abaixo de ~80pt
// a ilustracao vira borrao, e um prop numerico deixaria alguem escrever
// `size={20}` e so descobrir no aparelho. O projeto ja pagou essa licao ao
// contrario quando os olhos do glyph pararam de ler em 1024px e nasceu o
// assets/brand/icon-mark.svg separado.
import { Image, type ImageStyle, type StyleProp } from 'react-native';

export const MASCOTE_SIZES = {
  /** Bolha do assistente, ao lado da fala. */
  sm: 96,
  /** Hoje: o mascote apoiado na bolha. */
  md: 134,
  /** Capitulo fechado: ele e' o assunto da tela. */
  lg: 178,
} as const;

export type MascoteSize = keyof typeof MASCOTE_SIZES;

interface Props {
  size: MascoteSize;
  style?: StyleProp<ImageStyle>;
}

export function Mascote({ size, style }: Props) {
  const lado = MASCOTE_SIZES[size];

  return (
    <Image
      testID="mascote"
      source={require('../../assets/brand/mascote.webp')}
      style={[{ width: lado, height: lado }, style]}
      resizeMode="contain"
      // Decorativo, mesma regra do Glyph: quem carrega o sentido e' a fala de
      // src/assistant/lines.ts, no texto ao lado. Anunciar "imagem" aqui so
      // atrapalharia quem ouve.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
