// supabase/functions/_shared/ingestion/numbering.ts
// Como cada fonte numera os capítulos (BER-59). Em obra dividida em partes — 1984 tem 8, 10 e 6
// capítulos —, um site pode numerar de 1 a 24 (livro inteiro) ou reiniciar em cada parte. Tratar
// "capítulo 1" de uma página sobre a Parte 2 como o capítulo 1 do livro coloca spoiler do meio do
// livro no primeiro capítulo, que foi o que aconteceu no quarto teste do 1984.
import { partsOf } from './locate.ts';
import type { DeclaredChapter, EditionChapter } from './types.ts';

/**
 * A fonte numera o livro inteiro quando declara um capítulo com número maior que a maior parte da
 * edição: esse número não caberia na contagem de nenhuma parte. Abaixo disso não dá para saber, e
 * a dúvida deixa a afirmação sem capítulo em vez de colocá-la no errado.
 */
export function sourceNumbersWholeBook(declared: DeclaredChapter[] | null, chapters: EditionChapter[]): boolean {
  const parts = partsOf(chapters);
  if (parts.length <= 1) return true;
  const maiorParte = Math.max(...parts.map((p) => p.length));
  const maiorDeclarado = Math.max(0, ...(declared ?? []).map((c) => c.number));
  return maiorDeclarado > maiorParte;
}

/**
 * A fonte sabe mesmo em que capítulo cada coisa acontece? Página sobre um capítulo só (declara 1 ou
 * 2 capítulos) sabe. Guia capítulo a capítulo, que declara muitos e espalha as afirmações por
 * vários, sabe. Resumo do livro inteiro que declara 24 capítulos e joga tudo no capítulo 1 não sabe
 * — foi o que levou a Sala 101 e o bilhete de Julia para o capítulo 1 do 1984 (BER-59).
 */
export const MIN_DISTINCT_CHAPTERS = 3;

export function chapterRefsLookReliable(declaredChapters: number, distinctChaptersInClaims: number): boolean {
  if (declaredChapters < MIN_DISTINCT_CHAPTERS) return true;
  return distinctChaptersInClaims >= MIN_DISTINCT_CHAPTERS;
}

/** Fontes cuja atribuição de capítulo é confiável, olhando as afirmações que cada uma gerou. */
export function reliableSources(
  sources: { id: string; declaredStructure: { number: number }[] | null }[],
  claims: { sourceId: string; chapterRef: { number: number | null; numberInPart: number | null; part: string | null } | null }[],
): Set<string> {
  const distintos = new Map<string, Set<string>>();
  for (const claim of claims) {
    if (!claim.chapterRef) continue;
    const chave = JSON.stringify([claim.chapterRef.part, claim.chapterRef.number, claim.chapterRef.numberInPart]);
    const set = distintos.get(claim.sourceId) ?? new Set<string>();
    set.add(chave);
    distintos.set(claim.sourceId, set);
  }
  return new Set(
    sources
      .filter((s) => chapterRefsLookReliable((s.declaredStructure ?? []).length, distintos.get(s.id)?.size ?? 0))
      .map((s) => s.id),
  );
}

