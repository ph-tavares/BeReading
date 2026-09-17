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
