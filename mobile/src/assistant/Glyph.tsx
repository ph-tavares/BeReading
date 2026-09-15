// O marcador do assistente: um marca-pagina em ambar com dois pontos que
// leem como um olhar. Fica em src/assistant (nao src/ui) porque e a cara do
// assistente antes de ser um primitivo generico de interface, ao lado de
// persona.ts e lines.ts, que ja moram aqui. E' a mesma forma que vira o
// icone do app na tarefa seguinte, por isso o path e a viewBox saem
// exportados a parte: quem gerar o PNG do icone reaproveita exatamente estes
// valores, sem redesenhar a mao.
import Svg, { Circle, Path } from 'react-native-svg';
import { color } from '../theme/tokens';

/** Path do marcador, dos mockups aprovados (spec 7.11). Proporcao 3:4. */
export const GLYPH_PATH = 'M2 4.5A4.5 4.5 0 0 1 6.5 0h11A4.5 4.5 0 0 1 22 4.5V30l-10-6.5L2 30Z';
export const GLYPH_VIEWBOX = '0 0 24 32';
export const GLYPH_EYE_RADIUS = 1.7;
export const GLYPH_EYES = [
  { cx: 8.6, cy: 10 },
  { cx: 15.4, cy: 10 },
] as const;

interface Props {
  /** Largura do marcador; a altura sai da proporcao 3:4 (viewBox 24x32). Padrao 20. */
  size?: number;
}

export function Glyph({ size = 20 }: Props) {
  const altura = (size * 32) / 24;

  return (
    <Svg
      testID="glyph"
      width={size}
      height={altura}
      viewBox={GLYPH_VIEWBOX}
      // Decorativo: quem le tela nao ganha nada ouvindo "imagem" aqui. Quando
      // o Glyph acompanha texto (ex.: bolha do assistente), o texto e que
      // carrega o significado.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path testID="glyph-shape" d={GLYPH_PATH} fill={color.accent} />
      {GLYPH_EYES.map((olho) => (
        <Circle key={`${olho.cx}-${olho.cy}`} cx={olho.cx} cy={olho.cy} r={GLYPH_EYE_RADIUS} fill={color.accentInk} />
      ))}
    </Svg>
  );
}
