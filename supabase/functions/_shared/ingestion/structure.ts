// supabase/functions/_shared/ingestion/structure.ts
// Estrutura de capítulos da edição (BER-59, spec §6.3). Confirmada pelo sumário ligado ao
// ISBN, por texto primário (A) ou por 2 grupos independentes concordando em quantidade,
// ordem e títulos. Sem estrutura confirmada nenhum fato é localizado: melhor um run
// `partial` do que fato no capítulo errado.
import { normalizePart, normalizeTitle } from './locate.ts';
import { bestWeightPerGroup, factConfidence } from './rules.ts';
import type { DeclaredChapter, SourceWeight, Support } from './types.ts';

/** Estrutura não é fato de enredo: basta texto primário ou 2 grupos independentes, de qualquer peso. */
function structureConfirmed(supports: Support[]): boolean {
  const weights = [...bestWeightPerGroup(supports).values()];
  return weights.includes('A') || weights.length >= 2;
}

export interface StructureCandidate {
  sourceId: string;
  independenceGroup: string;
  weight: SourceWeight;
  tiedToIsbn: boolean;
  chapters: DeclaredChapter[];
}

export interface ConfirmedStructure {
  chapters: DeclaredChapter[];
  confidence: number;
  basis: 'isbn' | 'primary' | 'independent';
}

export function mergeDeclared(lists: DeclaredChapter[][]): DeclaredChapter[] {
  const byNumber = new Map<number, DeclaredChapter>();
  for (const list of lists) {
    for (const chapter of list) {
      const current = byNumber.get(chapter.number);
      byNumber.set(chapter.number, current
        ? {
          number: chapter.number,
          part: current.part ?? chapter.part,
          numberInPart: current.numberInPart ?? chapter.numberInPart,
          title: current.title ?? chapter.title,
        }
        : { ...chapter });
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function isContiguous(chapters: DeclaredChapter[]): boolean {
  return chapters.length > 0 && chapters.every((c, i) => c.number === i + 1);
}

export function compatible(a: DeclaredChapter[], b: DeclaredChapter[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    if (x.number !== y.number) return false;
    if (x.part && y.part && normalizePart(x.part) !== normalizePart(y.part)) return false;
    if (x.numberInPart !== null && y.numberInPart !== null && x.numberInPart !== y.numberInPart) return false;
    if (x.title && y.title && normalizeTitle(x.title) !== normalizeTitle(y.title)) return false;
    return true;
  });
}

function compatibleWithAll(members: StructureCandidate[], candidate: StructureCandidate): boolean {
  return members.every((m) => compatible(m.chapters, candidate.chapters));
}

/** Um grupo só aceita quem é compatível com todos os membros: "compatível" não é transitivo quando falta título. */
function cluster(candidates: StructureCandidate[]): StructureCandidate[][] {
  const clusters: StructureCandidate[][] = [];
  for (const candidate of candidates) {
    const home = clusters.find((c) => compatibleWithAll(c, candidate));
    if (home) home.push(candidate);
    else clusters.push([candidate]);
  }
  return clusters;
}

const supportsOf = (members: StructureCandidate[]): Support[] =>
  members.map((m) => ({ independenceGroup: m.independenceGroup, weight: m.weight }));

/**
 * Apoio de um grupo: os membros e toda fonte compatível com todos eles. Um sumário sem títulos
 * apoia cada estrutura com que é compatível; se isso confirmar duas estruturas rivais, nenhuma
 * confirma (spec §6.3, BER-59).
 */
function supportersOf(members: StructureCandidate[], all: StructureCandidate[]): StructureCandidate[] {
  return all.filter((c) => members.includes(c) || compatibleWithAll(members, c));
}

function build(members: StructureCandidate[], all: StructureCandidate[], basis: ConfirmedStructure['basis']): ConfirmedStructure {
  const supporters = supportersOf(members, all);
  const confidence = basis === 'isbn'
    ? Math.max(0.7, factConfidence(supportsOf(supporters), false))
    : factConfidence(supportsOf(supporters), false);
  return { chapters: mergeDeclared(supporters.map((s) => s.chapters)), confidence, basis };
}

export function confirmStructure(candidates: StructureCandidate[]): ConfirmedStructure | null {
  const valid = candidates.filter((c) => isContiguous(c.chapters));

  const tied = valid.filter((c) => c.tiedToIsbn);
  if (tied.length > 0) {
    const tiedClusters = cluster(tied);
    return tiedClusters.length === 1 ? build(tiedClusters[0], valid, 'isbn') : null;
  }

  const confirmed = cluster(valid).filter((members) => structureConfirmed(supportsOf(supportersOf(members, valid))));
  if (confirmed.length !== 1) return null;
  const members = confirmed[0];
  const basis = supportersOf(members, valid).some((m) => m.weight === 'A') ? 'primary' : 'independent';
  return build(members, valid, basis);
}
