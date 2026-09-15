import { filterReachedChapters } from '../../src/utils/pendingQuizzes';
import type { Chapter, StudentBook } from '../../src/types/database';

function chapter(id: string, bookId: string, number: number, endPage: number): Chapter {
  return { id, book_id: bookId, number, title: `Cap ${number}`, start_page: endPage - 19, end_page: endPage } as Chapter;
}

function studentBook(bookId: string, currentPage: number): StudentBook {
  return {
    id: `sb-${bookId}`,
    user_id: 'u1',
    book_id: bookId,
    status: 'reading',
    current_page: currentPage,
    started_at: '2026-09-01T00:00:00Z',
    finished_at: null,
  };
}

describe('filterReachedChapters', () => {
  it('mantém só os capítulos que o leitor já passou', () => {
    const chapters = [
      chapter('c1', 'b1', 1, 20),
      chapter('c2', 'b1', 2, 40),
      chapter('c3', 'b1', 3, 60),
    ];
    const reached = filterReachedChapters(chapters, [studentBook('b1', 45)]);
    expect(reached.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  // O motivo de este módulo existir: a query devolve capítulos de qualquer livro
  // do catálogo, não só dos que o leitor abriu.
  it('descarta capítulos de livros que o leitor nem começou', () => {
    const chapters = [chapter('c1', 'b1', 1, 20), chapter('x1', 'b9', 1, 20)];
    const reached = filterReachedChapters(chapters, [studentBook('b1', 30)]);
    expect(reached.map((c) => c.id)).toEqual(['c1']);
  });

  it('capítulo exatamente na página atual conta como alcançado', () => {
    const reached = filterReachedChapters([chapter('c1', 'b1', 1, 20)], [studentBook('b1', 20)]);
    expect(reached).toHaveLength(1);
  });

  it('capítulo à frente da página atual não conta', () => {
    const reached = filterReachedChapters([chapter('c2', 'b1', 2, 40)], [studentBook('b1', 39)]);
    expect(reached).toHaveLength(0);
  });

  it('ordena por número do capítulo — o mais antigo pendente vem primeiro', () => {
    const chapters = [chapter('c3', 'b1', 3, 60), chapter('c1', 'b1', 1, 20), chapter('c2', 'b1', 2, 40)];
    const reached = filterReachedChapters(chapters, [studentBook('b1', 100)]);
    expect(reached.map((c) => c.number)).toEqual([1, 2, 3]);
  });

  // BER-72 deixou start_page/end_page nulos em `chapters`, porque nenhuma fonte
  // publica de metadado tem paginacao por capitulo. Ate agora o tipo dizia
  // `number` e este caso passava por coercao silenciosa (`x >= null` vira
  // `x >= 0`, sempre verdadeiro). Virou decisao escrita, e este teste existe pra
  // que mudar de ideia seja uma escolha, nao um efeito colateral.
  it('capitulo sem paginacao conta como alcancado, e isso e' + "'" + ' decisao, nao acidente', () => {
    const semPaginas = {
      id: 'c-sp', book_id: 'b1', number: 1, title: 'Cap 1',
      start_page: null, end_page: null,
    } satisfies Chapter;

    expect(filterReachedChapters([semPaginas], [studentBook('b1', 1)])).toEqual([semPaginas]);
    // Mesmo com o leitor na primeira pagina: nao ha como saber se terminou.
    expect(filterReachedChapters([semPaginas], [studentBook('b1', 0)])).toEqual([semPaginas]);
    // Mas continua valendo a regra de so contar livro que o leitor tem.
    expect(filterReachedChapters([semPaginas], [studentBook('b2', 999)])).toEqual([]);
  });

  it('sem livros ou sem capítulos, não sobra nada', () => {
    expect(filterReachedChapters([chapter('c1', 'b1', 1, 20)], [])).toEqual([]);
    expect(filterReachedChapters([], [studentBook('b1', 100)])).toEqual([]);
  });
});
