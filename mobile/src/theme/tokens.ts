// Luminous Library — single source of truth for colors/radii/motion.
// Tailwind classes usam estes mesmos valores via tailwind.config.js.

export const colors = {
  bg: '#0F172A',
  bgRaise: '#1E293B',
  bgSunk: '#0B1220',
  surface: '#243247',
  surface2: '#2F3F58',
  hairline: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',

  text: '#F8FAFC',
  textSoft: '#CBD5E1',
  textMute: '#94A3B8',
  textDim: '#64748B',

  green: '#22C55E',
  greenDeep: '#15803D',
  greenGlow: 'rgba(34,197,94,0.35)',
  purple: '#A855F7',
  purpleDeep: '#7E22CE',
  purpleGlow: 'rgba(168,85,247,0.35)',
  flame: '#F97316',
  flameDeep: '#C2410C',
  flameGlow: 'rgba(249,115,22,0.4)',
  gold: '#FACC15',
  goldDeep: '#A16207',
  goldGlow: 'rgba(250,204,21,0.35)',
  sky: '#38BDF8',
  skyDeep: '#0369A1',
  skyGlow: 'rgba(56,189,248,0.35)',
  rose: '#F43F5E',
  roseDeep: '#9F1239',
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
} as const;

export const fonts = {
  medium: 'PlusJakarta_500Medium',
  semi: 'PlusJakarta_600SemiBold',
  bold: 'PlusJakarta_700Bold',
  black: 'PlusJakarta_800ExtraBold',
} as const;

export type BrandColor = 'green' | 'purple' | 'flame' | 'gold' | 'sky' | 'rose';

export function brandTriplet(name: BrandColor): { color: string; deep: string; glow: string } {
  const map: Record<BrandColor, { color: string; deep: string; glow: string }> = {
    green:  { color: colors.green,  deep: colors.greenDeep,  glow: colors.greenGlow  },
    purple: { color: colors.purple, deep: colors.purpleDeep, glow: colors.purpleGlow },
    flame:  { color: colors.flame,  deep: colors.flameDeep,  glow: colors.flameGlow  },
    gold:   { color: colors.gold,   deep: colors.goldDeep,   glow: colors.goldGlow   },
    sky:    { color: colors.sky,    deep: colors.skyDeep,    glow: colors.skyGlow    },
    rose:   { color: colors.rose,   deep: colors.roseDeep,   glow: 'rgba(244,63,94,0.35)' },
  };
  return map[name];
}
