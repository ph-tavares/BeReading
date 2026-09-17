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
  /**
   * A fonte lista todos os capítulos do livro (sumário completo, ou o próprio texto integral). Lista
   * parcial (página de um capítulo, índice lido pela metade) não fala da contagem: só apoia ou
   * contradiz os capítulos que traz (spec §11, item 24).
   */
  complete: boolean;
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

/** Números seguidos, começando em qualquer capítulo (ex.: 3 a 24). */
function isContiguousRun(chapters: DeclaredChapter[]): boolean {
  return chapters.length > 0 && chapters.every((c, i) => c.number === chapters[0].number + i);
}

function sameChapter(x: DeclaredChapter, y: DeclaredChapter): boolean {
  if (x.number !== y.number) return false;
  if (x.part && y.part && normalizePart(x.part) !== normalizePart(y.part)) return false;
  if (x.numberInPart !== null && y.numberInPart !== null && x.numberInPart !== y.numberInPart) return false;
  if (x.title && y.title && normalizeTitle(x.title) !== normalizeTitle(y.title)) return false;
  return true;
}

export function compatible(a: DeclaredChapter[], b: DeclaredChapter[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => sameChapter(x, b[i]));
}

/** Lista parcial cabe na estrutura completa: nenhum número além do último e cada capítulo bate. */
function fitsInto(full: DeclaredChapter[], partial: DeclaredChapter[]): boolean {
  return partial.every((p) => p.number <= full.length && sameChapter(full[p.number - 1], p));
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

/**
 * Apoio completo: as listas completas compatíveis e as parciais que cabem na estrutura e chegam
 * ao último capítulo. Parcial que não chega ao fim não confirma a contagem (uma página só do
 * capítulo 1 caberia em qualquer edição), então não conta como grupo.
 */
function allSupporters(members: StructureCandidate[], valid: StructureCandidate[], partials: StructureCandidate[]): StructureCandidate[] {
  const full = members[0].chapters;
  const reachingEnd = partials.filter((p) => fitsInto(full, p.chapters) && p.chapters[p.chapters.length - 1].number === full.length);
  return [...supportersOf(members, valid), ...reachingEnd];
}

function build(
  members: StructureCandidate[],
  all: StructureCandidate[],
  basis: ConfirmedStructure['basis'],
  partials: StructureCandidate[] = [],
): ConfirmedStructure {
  const supporters = allSupporters(members, all, partials);
  const confidence = basis === 'isbn'
    ? Math.max(0.7, factConfidence(supportsOf(supporters), false))
    : factConfidence(supportsOf(supporters), false);
  return { chapters: mergeDeclared(supporters.map((s) => s.chapters)), confidence, basis };
}

export function confirmStructure(candidates: StructureCandidate[]): ConfirmedStructure | null {
  const valid = candidates.filter((c) => c.complete && isContiguous(c.chapters));
  const partials = candidates.filter((c) => !(c.complete && isContiguous(c.chapters)) && isContiguousRun(c.chapters));

  const tied = valid.filter((c) => c.tiedToIsbn);
  if (tied.length > 0) {
    const tiedClusters = cluster(tied);
    return tiedClusters.length === 1 ? build(tiedClusters[0], valid, 'isbn', partials) : null;
  }

  const confirmed = cluster(valid).filter((members) => structureConfirmed(supportsOf(allSupporters(members, valid, partials))));
  if (confirmed.length !== 1) return null;
  const members = confirmed[0];
  const supporters = supportersOf(members, valid);
  // Spec §6.3 (BER-59): sem fonte ligada ao ISBN, qualquer fonte válida que discorde da estrutura
  // pode ser de outra edição — não dá para saber qual vale, então nada confirma. Custo aceito:
  // uma única fonte errada bloqueia a confirmação e o run fecha como `partial`.
  if (valid.some((c) => !supporters.includes(c) && !compatibleWithAll(members, c))) return null;
  // Lista parcial que contradiz algum capítulo (título diferente, número além do último) também é
  // conflito; a que só não cobre tudo, não (spec §11, item 24).
  if (partials.some((p) => !fitsInto(members[0].chapters, p.chapters))) return null;
  const basis = allSupporters(members, valid, partials).some((m) => m.weight === 'A') ? 'primary' : 'independent';
  return build(members, valid, basis, partials);
}

/**
 * Melhor palpite de estrutura quando nada confirmou: a maior lista completa, ou, sem nenhuma, a
 * maior lista que começa no capítulo 1. Serve só para buscar capítulo a capítulo antes de uma
 * segunda tentativa de confirmação (spec §11, item 25); nunca localiza fato.
 */
export function bestStructureGuess(candidates: StructureCandidate[]): DeclaredChapter[] | null {
  const fromOne = candidates.filter((c) => isContiguous(c.chapters));
  const pool = fromOne.some((c) => c.complete) ? fromOne.filter((c) => c.complete) : fromOne;
  const best = [...pool].sort((a, b) => b.chapters.length - a.chapters.length)[0];
  return best ? best.chapters : null;
}
