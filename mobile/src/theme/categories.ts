import { Compass, Crown, Target, Star, Zap } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { colors } from './tokens';

export interface Category {
  id: string;
  label: string;
  color: string;
  Icon: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export const CATEGORIES: Category[] = [
  { id: 'aventura',  label: 'Aventura',  color: colors.green,  Icon: Compass },
  { id: 'classico',  label: 'Clássicos', color: colors.gold,   Icon: Crown },
  { id: 'misterio',  label: 'Mistério',  color: colors.sky,    Icon: Target },
  { id: 'fabula',    label: 'Fábula',    color: colors.purple, Icon: Star },
  { id: 'gotico',    label: 'Gótico',    color: colors.rose,   Icon: Zap },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function categoryOf(genre: string | null | undefined): Category | null {
  if (!genre) return null;
  const key = normalize(genre);
  return CATEGORIES.find((c) => normalize(c.id) === key || key.includes(c.id)) ?? null;
}
