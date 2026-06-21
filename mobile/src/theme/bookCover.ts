import { colors, type BrandColor } from './tokens';

const EMBLEMS = ['sword', 'star', 'compass', 'target', 'crown', 'zap'] as const;
export type Emblem = typeof EMBLEMS[number];

const PALETTE: Array<{ color: string; deep: string; brand: BrandColor }> = [
  { color: colors.flame,  deep: colors.flameDeep,  brand: 'flame'  },
  { color: colors.purple, deep: colors.purpleDeep, brand: 'purple' },
  { color: colors.green,  deep: colors.greenDeep,  brand: 'green'  },
  { color: colors.sky,    deep: colors.skyDeep,    brand: 'sky'    },
  { color: colors.gold,   deep: colors.goldDeep,   brand: 'gold'   },
  { color: colors.rose,   deep: colors.roseDeep,   brand: 'rose'   },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deriva cor+emblema determinísticos a partir de book.id.
 */
export function coverFromId(id: string): { color: string; deep: string; emblem: Emblem } {
  const h = hashStr(id);
  const p = PALETTE[h % PALETTE.length];
  const emblem = EMBLEMS[(h >>> 4) % EMBLEMS.length];
  return { color: p.color, deep: p.deep, emblem };
}
