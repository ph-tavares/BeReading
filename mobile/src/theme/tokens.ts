// Design system do redesign (BER-77) — fonte única de verdade.
// Contrato legível em mobile/DESIGN.md. Nenhum valor visual existe fora daqui:
// __tests__/guards barra hex e fontSize soltos em src/ui, src/assistant e
// src/game — as pastas que a F2 entregou. app/ e src/features (blocos de
// tela) ainda não existem em código; entram sob guarda na F4.

export const color = {
  bg: '#12100E',
  surface1: '#1B1916',
  surface2: '#25221E',
  surface3: '#302C27',
  floating: '#2A2622',
  // Fundo escurecido atras de sheet e modal: esconde a tela sem apagar o
  // contexto de onde o leitor veio.
  scrim: 'rgba(0,0,0,0.6)',

  line: 'rgba(243,237,226,0.08)',
  line2: 'rgba(243,237,226,0.14)',

  text: '#F3EDE2',
  text2: '#B9B0A3',
  // Era #978E82: reprovava AA (4,5) sobre surface3 (4,295) e apertava sobre
  // floating (4,652) — as duas superfícies onde legenda/desabilitado convive
  // com "pressed" e toast. #A0978B passa nas cinco superfícies com folga
  // (mínimo 4,814); ver __tests__/theme/tokens.test.ts.
  text3: '#A0978B',

  accent: '#F0A83A',
  accentInk: '#1B1206',
  accentSoft: 'rgba(240,168,58,0.14)',

  positive: '#8CC28F',
  positiveSoft: 'rgba(140,194,143,0.14)',
  danger: '#EE7B67',
  dangerSoft: 'rgba(238,123,103,0.14)',
} as const;

/** Cores das capas geradas. O creme COVER_INK é legível sobre todas (teste cobre). */
export const COVER_PALETTE_COLORS = [
  '#5E2A2A', '#2F4A3A', '#22324F', '#7A5A1E',
  '#4A2F4F', '#1F4A4F', '#3A3F47', '#7A3B22',
] as const;

export const COVER_INK = '#F6E9D4';

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24, xxl: 32, xxxl: 40, huge: 48,
} as const;

export const radius = {
  tag: 6, chip: 10, control: 14, card: 20, sheet: 28, pill: 999,
} as const;

export const fontFamily = {
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  ui: 'HankenGrotesk_400Regular',
  uiMedium: 'HankenGrotesk_500Medium',
  uiSemi: 'HankenGrotesk_600SemiBold',
  uiBold: 'HankenGrotesk_700Bold',
} as const;

export type TypeVariant =
  | 'display' | 'title' | 'heading' | 'subhead' | 'body' | 'reading'
  | 'callout' | 'label' | 'caption' | 'button'
  | 'numericXL' | 'numericL' | 'numericM';

interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontStyle?: 'italic';
  fontVariant?: ['tabular-nums'];
  /** Teto do Dynamic Type: acima disso o layout quebra. */
  maxFontSizeMultiplier: number;
}

// A camada do livro fala em serifa; a da interface, em sans. Números sempre
// tabulares, para não "pular" quando contam.
export const type: Record<TypeVariant, TypeStyle> = {
  display:   { fontFamily: fontFamily.serifMedium, fontSize: 34, lineHeight: 38, letterSpacing: -0.4, maxFontSizeMultiplier: 1.2 },
  title:     { fontFamily: fontFamily.serifMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, maxFontSizeMultiplier: 1.2 },
  heading:   { fontFamily: fontFamily.serifMedium, fontSize: 22, lineHeight: 28, maxFontSizeMultiplier: 1.3 },
  subhead:   { fontFamily: fontFamily.uiSemi,      fontSize: 17, lineHeight: 24, maxFontSizeMultiplier: 1.3 },
  body:      { fontFamily: fontFamily.ui,          fontSize: 16, lineHeight: 24, maxFontSizeMultiplier: 1.4 },
  reading:   { fontFamily: fontFamily.serif,       fontSize: 17, lineHeight: 27, fontStyle: 'italic', maxFontSizeMultiplier: 1.4 },
  callout:   { fontFamily: fontFamily.ui,          fontSize: 14, lineHeight: 20, maxFontSizeMultiplier: 1.3 },
  label:     { fontFamily: fontFamily.uiSemi,      fontSize: 13, lineHeight: 18, maxFontSizeMultiplier: 1.3 },
  caption:   { fontFamily: fontFamily.uiMedium,    fontSize: 12, lineHeight: 16, maxFontSizeMultiplier: 1.3 },
  button:    { fontFamily: fontFamily.uiSemi,      fontSize: 16, lineHeight: 20, maxFontSizeMultiplier: 1.2 },
  numericXL: { fontFamily: fontFamily.uiBold, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericL:  { fontFamily: fontFamily.uiBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericM:  { fontFamily: fontFamily.uiBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.2 },
};

// Regras de motion da Wiki (standards/frontend/animation-patterns.md): saída em
// ~2/3 da entrada, ease-out no enter e ease-in no exit, nada de scale(0).
export const motion = {
  press: { damping: 18, stiffness: 320, mass: 0.6, scale: 0.98 },
  enter: { duration: 240, translateY: 8 },
  exit: { duration: 160 },
  stagger: { step: 40, max: 6 },
  // A curva vai como os quatro pontos de controle de uma cubic-bezier (aqui, a
  // ease-out cúbica), e não como função: tokens.ts não depende do Reanimated.
  // Quem anima monta Easing.bezier(...motion.count.easing).
  count: { duration: 600, easing: [0.33, 1, 0.68, 1] },
  skeleton: { duration: 200 },
  // Pulso do Skeleton (opacidade indo e voltando em loop): duração própria,
  // diferente de `skeleton` acima, que é o crossfade de 200ms para o
  // conteúdo real quando o carregamento termina — propósitos distintos, sem
  // reaproveitar um pelo outro.
  pulse: { duration: 800 },
} as const;

export const elevation = {
  flat: {},
  surface: { backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
  floating: {
    backgroundColor: color.floating,
    borderWidth: 1,
    borderColor: color.line2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

/** Alvo mínimo de toque (HIG e Material). */
export const MIN_TOUCH = 44;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
