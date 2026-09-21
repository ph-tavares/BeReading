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

const withPart = (c: DeclaredChapter) => c.part !== null && c.numberInPart !== null;

/**
 * Acumula a lista declarada de UMA fonte, bloco a bloco, sem juntar capítulos de partes diferentes
 * (defeito 5 da BER-59, run local de 21/09/2026). No texto integral do 1984, cada bloco do meio do
 * livro mostra "Chapter 1" sem o cabeçalho da parte; juntando pelo número, os capítulos 1 a 8 das
 * três partes viravam um só, e o archive.org declarava 8 capítulos em vez de 24. Aqui a chave é a
 * parte mais o número dentro dela, quando a parte é conhecida.
 */
export function mergeDeclaredKeepingParts(lists: DeclaredChapter[][]): DeclaredChapter[] {
  const byKey = new Map<string, DeclaredChapter>();
  for (const list of lists) {
    for (const chapter of list) {
      const key = withPart(chapter) ? `p${normalizePart(chapter.part)}:${chapter.numberInPart}` : `n${chapter.number}`;
      const current = byKey.get(key);
      byKey.set(key, current ? { ...current, title: current.title ?? chapter.title } : { ...chapter });
    }
  }
  return [...byKey.values()];
}

/**
 * A lista da fonte na numeração do livro inteiro, que é a que a estrutura confirma. Com partes, o
 * número vira a soma dos capítulos das partes anteriores mais o número dentro da parte. Só quando
 * dá para ter certeza: partes seguidas desde a 1 e, em cada parte, capítulos seguidos desde o 1.
 * Faltou um pedaço, a conta erraria o número de todos os capítulos seguintes (e número errado é
 * spoiler: foi assim que a Sala 101 foi parar no capítulo 1), então a lista não serve como
 * candidata e devolve `null`.
 *
 * Só para a estrutura. Onde a fonte numera as próprias afirmações (`sourceNumbersWholeBook`) continua
 * valendo a numeração crua dela.
 */
export function wholeBookNumbering(list: DeclaredChapter[]): DeclaredChapter[] | null {
  const parted = list.filter(withPart);
  if (parted.length === 0) return mergeDeclared([list]);

  const byPart = new Map<number, DeclaredChapter[]>();
  for (const chapter of parted) {
    const part = Number(normalizePart(chapter.part));
    if (!Number.isInteger(part) || part < 1) return null;
    byPart.set(part, [...(byPart.get(part) ?? []), chapter]);
  }
  const partNumbers = [...byPart.keys()].sort((a, b) => a - b);
  if (!partNumbers.every((p, i) => p === i + 1)) return null;

  const result: DeclaredChapter[] = [];
  for (const part of partNumbers) {
    const chapters = [...byPart.get(part)!].sort((a, b) => a.numberInPart! - b.numberInPart!);
    if (!chapters.every((c, i) => c.numberInPart === i + 1)) return null;
    const offset = result.length;
    for (const c of chapters) {
      result.push({ number: offset + c.numberInPart!, part: `Parte ${part}`, numberInPart: c.numberInPart, title: c.title });
    }
  }
  return result;
}

/**
 * Capítulos que as afirmações de um texto integral citam, com a parte que o nosso código achou
 * (defeito 5). O texto integral narra o livro inteiro em ordem, então cada capítulo aparece nas
 * afirmações, mesmo quando o modelo deixa de pô-lo na lista declarada do bloco: no run local do
 * 1984 de 21/09/2026, a lista trouxe só 7 dos 8 capítulos da Parte 1 e nenhum da Parte 2, enquanto
 * as afirmações citavam todos. Só para texto integral: numa resenha, citar um capítulo não diz que
 * ele existe naquela edição.
 */
export function chaptersFromClaims(claims: { chapterRef: DeclaredChapter | { number: number | null; part: string | null; numberInPart: number | null } | null; forwardReference: boolean }[]): DeclaredChapter[] {
  return claims
    .filter((c) => !c.forwardReference && c.chapterRef?.part && c.chapterRef.numberInPart !== null)
    .map((c) => ({ number: c.chapterRef!.numberInPart!, part: c.chapterRef!.part, numberInPart: c.chapterRef!.numberInPart, title: null }));
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

/**
 * Lista parcial cabe na estrutura completa: nenhum número além do último e nenhum título diferente
 * no mesmo capítulo. Parte e número dentro da parte não entram na comparação (BER-59): quem lista
 * só um trecho costuma reiniciar a contagem da parte, e no teste de 1984 o índice que começava no
 * capítulo 3 numerava-o como o primeiro da parte, o que sozinho derrubava a confirmação.
 */
function fitsInto(full: DeclaredChapter[], partial: DeclaredChapter[]): boolean {
  return partial.every((p) => {
    if (p.number > full.length) return false;
    const f = full[p.number - 1];
    return !(f.title && p.title) || normalizeTitle(f.title) === normalizeTitle(p.title);
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
  const complete = candidates.filter((c) => c.complete && isContiguous(c.chapters));
  const partials = candidates.filter((c) => !(c.complete && isContiguous(c.chapters)) && isContiguousRun(c.chapters));

  // Lista completa que termina antes de um capítulo descrito por uma lista parcial está refutada:
  // foi lida pela metade. Duas listas completas em desacordo continuam sendo conflito de edição, e
  // nenhuma confirma. No segundo teste de 1984 (BER-59), uma lista de 23 capítulos rivalizava com a
  // de 24 e derrubava as duas, embora um índice parcial descrevesse o capítulo 24.
  const maiorEmParcial = Math.max(...partials.map((p) => p.chapters[p.chapters.length - 1].number), 0);
  const valid = complete.filter((c) => c.chapters.length >= maiorEmParcial);

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
 * lista de números seguidos que chega mais longe, com os capítulos que faltam no começo sem título.
 * Serve só para buscar capítulo a capítulo antes de uma segunda tentativa de confirmação (spec §11,
 * itens 25 e 44); nunca localiza fato.
 */
export function bestStructureGuess(candidates: StructureCandidate[]): DeclaredChapter[] | null {
  const completas = candidates.filter((c) => c.complete && isContiguous(c.chapters));
  if (completas.length > 0) return [...completas].sort((a, b) => b.chapters.length - a.chapters.length)[0].chapters;

  // Empate no último capítulo: a lista que traz mais capítulos de verdade, e com eles mais títulos.
  const seguidas = candidates
    .filter((c) => isContiguousRun(c.chapters))
    .sort((a, b) => b.chapters[b.chapters.length - 1].number - a.chapters[a.chapters.length - 1].number || b.chapters.length - a.chapters.length);
  if (seguidas.length === 0) return null;
  const { chapters } = seguidas[0];
  const faltantes = Array.from({ length: chapters[0].number - 1 }, (_, i) => ({ number: i + 1, part: null, numberInPart: null, title: null }));
  return [...faltantes, ...chapters];
}
