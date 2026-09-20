// Design system do redesign (BER-77) — fonte única de verdade.
// Contrato legível em mobile/DESIGN.md. Nenhum valor visual existe fora daqui:
// __tests__/guards barra hex e fontSize soltos em src/ui, src/assistant e
// src/game — as pastas que a F2 entregou. app/ e src/features (blocos de
// tela) ainda não existem em código; entram sob guarda na F4.

export const color = {
  // BER-120: os neutros saíram do marrom-tinta para um preto esverdeado, a
  // base do mascote. Só a temperatura mudou — a escala de luminosidade é a
  // mesma, então nenhum par de contraste piorou (tokens.test.ts cobre os cinco).
  bg: '#0A1310',
  surface1: '#111F1A',
  surface2: '#192B24',
  surface3: '#23392F',
  floating: '#1B2C25',
  // Fundo escurecido atras de sheet e modal: esconde a tela sem apagar o
  // contexto de onde o leitor veio.
  scrim: 'rgba(0,0,0,0.6)',

  line: 'rgba(246,241,228,0.08)',
  line2: 'rgba(246,241,228,0.14)',

  text: '#F6F1E4',
  text2: '#AFBCB2',
  // Mesma armadilha que o #978E82 tinha na F2, agora na família verde: o
  // #84938B do mockup reprovava AA sobre surface3 (3,84). O #9AA8A0 passa nas
  // cinco superfícies (mínimo 5,00). Legenda é o token que mais sofre quando a
  // base muda de tom — confira-o sempre que mexer nas superfícies.
  text3: '#9AA8A0',

  // A camada de JOGO. Não mudou na BER-120, de propósito: XP, nível, sequência
  // e conquista continuam âmbar porque a mecânica delas também não mudou.
  accent: '#F0A83A',
  accentInk: '#1B1206',
  accentSoft: 'rgba(240,168,58,0.14)',

  // A camada de LEITURA E AÇÃO (BER-120). O jade do moletom do mascote.
  // `brand` é preenchimento — bloco do livro, botão primário, aba ativa — e
  // reprova como texto (3,83 sobre surface3). Para letra existe `brandText`,
  // a mesma família clareada. Não troque um pelo outro: o teste registra por
  // que os dois existem.
  brand: '#1BA36B',
  brandInk: '#04231A',
  brandText: '#2FC98A',
  brandSoft: 'rgba(27,163,107,0.14)',

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

// BER-120: a serifa saiu. `display*` é Unbounded, uma grotesca larga e
// arredondada que carrega título e número; `ui*` é Bricolage Grotesque, que
// tem pequenas esquisitices de desenho e continua legível em 12px. As duas
// são SIL Open Font License 1.1.
export const fontFamily = {
  display: 'Unbounded_700Bold',
  displayHeavy: 'Unbounded_800ExtraBold',
  ui: 'BricolageGrotesque_400Regular',
  uiMedium: 'BricolageGrotesque_500Medium',
  uiSemi: 'BricolageGrotesque_600SemiBold',
  uiBold: 'BricolageGrotesque_700Bold',
} as const;

/**
 * `reading` (serifa itálica) saiu junto com a serifa. Ela existia para a
 * "camada do livro" ter voz própria, mas nenhuma tela chegou a usá-la:
 * conferido em 20/09 com grep em `src/` e `app/`, zero consumidores. Quem
 * realmente falava pela serifa era o título, e título agora é Unbounded.
 */
export type TypeVariant =
  | 'display' | 'title' | 'heading' | 'subhead' | 'body'
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

// Unbounded fala pelo que grita (título e número); Bricolage, pelo que
// trabalha (interface e texto corrido). Números sempre tabulares, para não
// "pular" quando contam.
//
// O tamanho de display e title CAIU (34→29, 28→22) e o tracking apertou. Não é
// recuo: Unbounded é uma face bem mais larga que Newsreader no mesmo corpo, e
// manter 34 estourava "Capítulo 4, fechado." em duas linhas numa moldura de
// 390pt. Medido no mockup aprovado antes de escolher os valores.
export const type: Record<TypeVariant, TypeStyle> = {
  display:   { fontFamily: fontFamily.displayHeavy, fontSize: 29, lineHeight: 33, letterSpacing: -0.9, maxFontSizeMultiplier: 1.2 },
  title:     { fontFamily: fontFamily.display,      fontSize: 22, lineHeight: 26, letterSpacing: -0.6, maxFontSizeMultiplier: 1.2 },
  heading:   { fontFamily: fontFamily.uiBold,       fontSize: 21, lineHeight: 26, letterSpacing: -0.3, maxFontSizeMultiplier: 1.3 },
  subhead:   { fontFamily: fontFamily.uiBold,       fontSize: 17, lineHeight: 22, maxFontSizeMultiplier: 1.3 },
  body:      { fontFamily: fontFamily.uiMedium,     fontSize: 16, lineHeight: 22, maxFontSizeMultiplier: 1.4 },
  callout:   { fontFamily: fontFamily.uiMedium,     fontSize: 14, lineHeight: 20, maxFontSizeMultiplier: 1.3 },
  label:     { fontFamily: fontFamily.uiBold,       fontSize: 13, lineHeight: 17, maxFontSizeMultiplier: 1.3 },
  caption:   { fontFamily: fontFamily.uiMedium,     fontSize: 12, lineHeight: 16, maxFontSizeMultiplier: 1.3 },
  button:    { fontFamily: fontFamily.uiBold,       fontSize: 16, lineHeight: 20, maxFontSizeMultiplier: 1.2 },
  numericXL: { fontFamily: fontFamily.displayHeavy, fontSize: 40, lineHeight: 44, letterSpacing: -2, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericL:  { fontFamily: fontFamily.displayHeavy, fontSize: 24, lineHeight: 28, letterSpacing: -0.9, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.1 },
  numericM:  { fontFamily: fontFamily.display,      fontSize: 17, lineHeight: 22, letterSpacing: -0.4, fontVariant: ['tabular-nums'], maxFontSizeMultiplier: 1.2 },
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
