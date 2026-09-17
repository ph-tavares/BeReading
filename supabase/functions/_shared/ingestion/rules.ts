// supabase/functions/_shared/ingestion/rules.ts
// Regras de confirmação da spec (§6.2), em código e não no modelo: a IA só agrupa
// afirmações equivalentes; quem decide se um fato entra na base é esta função,
// testável e igual para todo livro (BER-59).
import { type ChapterStatus, type SourceWeight, type Support, WEIGHT_VALUE } from './types.ts';

/** Capítulo `confirmed` a partir deste número de fatos confirmados. Calibrado na aceitação. */
export const MIN_FACTS_CONFIRMED = 5;
/** Desconto na confiança de um fato que venceu uma contradição. */
export const CONTRADICTION_PENALTY = 0.3;
/** Tema e interpretação precisam deste número de grupos independentes. */
export const MIN_INTERPRETATION_GROUPS = 2;
/** Um lado de uma contradição só vence se o apoio dele for pelo menos este múltiplo do outro. */
export const COMPARABLE_SUPPORT_RATIO = 2;

const ORDER: SourceWeight[] = ['A', 'B', 'C', 'D'];

export function bestWeightPerGroup(supports: Support[]): Map<string, SourceWeight> {
  const best = new Map<string, SourceWeight>();
  for (const { independenceGroup, weight } of supports) {
    const current = best.get(independenceGroup);
    if (!current || ORDER.indexOf(weight) < ORDER.indexOf(current)) {
      best.set(independenceGroup, weight);
    }
  }
  return best;
}

export function isConfirmed(supports: Support[], isInterpretation: boolean): boolean {
  const weights = [...bestWeightPerGroup(supports).values()];
  if (isInterpretation) return weights.length >= MIN_INTERPRETATION_GROUPS;
  if (weights.includes('A')) return true;
  if (weights.length >= 2 && weights.some((w) => w === 'B' || w === 'C')) return true;
  return weights.length >= 3;
}

/** Soma dos pesos do melhor apoio de cada grupo. */
export function supportScore(supports: Support[]): number {
  let total = 0;
  for (const weight of bestWeightPerGroup(supports).values()) total += WEIGHT_VALUE[weight];
  return total;
}

export function resolveContradiction(a: Support[], b: Support[]): 'a' | 'b' | 'neither' {
  const aHasA = a.some((x) => x.weight === 'A');
  const bHasA = b.some((x) => x.weight === 'A');
  if (aHasA !== bHasA) return aHasA ? 'a' : 'b';

  const scoreA = supportScore(a);
  const scoreB = supportScore(b);
  if (scoreA >= scoreB * COMPARABLE_SUPPORT_RATIO && isConfirmed(a, false)) return 'a';
  if (scoreB >= scoreA * COMPARABLE_SUPPORT_RATIO && isConfirmed(b, false)) return 'b';
  return 'neither';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function factConfidence(supports: Support[], contradicted: boolean): number {
  let missing = 1;
  for (const weight of bestWeightPerGroup(supports).values()) missing *= 1 - WEIGHT_VALUE[weight];
  const base = 1 - missing;
  return round2(Math.min(1, Math.max(0, contradicted ? base - CONTRADICTION_PENALTY : base)));
}

export function chapterStatus(confirmedFactCount: number): ChapterStatus {
  if (confirmedFactCount >= MIN_FACTS_CONFIRMED) return 'confirmed';
  return confirmedFactCount > 0 ? 'partial' : 'insufficient';
}

export function chapterConfidence(factConfidences: number[]): number {
  if (factConfidences.length === 0) return 0;
  return round2(factConfidences.reduce((sum, c) => sum + c, 0) / factConfidences.length);
}
