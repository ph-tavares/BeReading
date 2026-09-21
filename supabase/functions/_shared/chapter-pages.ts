// supabase/functions/_shared/chapter-pages.ts
// Páginas de cada capítulo quando ninguém sabe onde ele começa (BER-60). Usado no cadastro do
// leitor (add-book) e quando a ingestão (BER-59) descobre a estrutura da edição e refaz os
// capítulos do livro do leitor: a mesma conta nos dois lugares.

export interface EstimatedChapter {
  number: number;
  title: string;
  start_page: number;
  end_page: number;
}

/**
 * Capítulos com páginas ESTIMADAS: o livro dividido em partes iguais.
 *
 * Nenhuma fonte pública dá a página em que cada capítulo começa (investigação da
 * BER-72). Sem `end_page`, o capítulo nunca fecha: `findNewlyCompletedChapters`
 * compara `end_page` com a página lida, e com nulo a comparação é sempre falsa
 * (comentário na BER-60, 15/09). Então o quiz do livro do leitor nunca existiria.
 * Partes iguais é aproximado, mas fecha capítulo; quando a ingestão (BER-59)
 * souber a estrutura da edição, é ela quem deve corrigir.
 */
export function estimateChapters(totalPages: number, chapterCount: number): EstimatedChapter[] {
  const tamanho = totalPages / chapterCount;
  return Array.from({ length: chapterCount }, (_, i) => ({
    number: i + 1,
    title: `Capítulo ${i + 1}`,
    start_page: Math.floor(i * tamanho) + 1,
    end_page: i === chapterCount - 1 ? totalPages : Math.floor((i + 1) * tamanho),
  }));
}
