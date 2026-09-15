import { exploreState, featuredBook, filterByGenre, genresOf } from '../../../src/features/explore/logic';

const livro = (id: string, genre: string | null) => ({ id, genre });

describe('genresOf', () => {
  it('generos reais, sem repetir, sem vazio, em ordem alfabetica', () => {
    const livros = [livro('a', 'Romance'), livro('b', ' Distopia '), livro('c', null), livro('d', 'Romance'), livro('e', '')];
    expect(genresOf(livros)).toEqual(['Distopia', 'Romance']);
  });
});

describe('filterByGenre', () => {
  it('null devolve todos; genero filtra pelo valor real', () => {
    const livros = [livro('a', 'Romance'), livro('b', 'Distopia ')];
    expect(filterByGenre(livros, null)).toHaveLength(2);
    expect(filterByGenre(livros, 'Distopia').map((b) => b.id)).toEqual(['b']);
  });
});

describe('exploreState', () => {
  it('lendo, lido, e o resto (inclusive tirado da leitura) e comecar', () => {
    const status = { a: 'reading', b: 'finished', c: 'dropped' };
    expect(exploreState(status, 'a')).toBe('reading');
    expect(exploreState(status, 'b')).toBe('finished');
    expect(exploreState(status, 'c')).toBe('start');
    expect(exploreState(status, 'z')).toBe('start');
  });
});

describe('featuredBook', () => {
  it('primeiro livro, na ordem recebida, que o leitor nao comecou', () => {
    const livros = [livro('a', null), livro('b', null), livro('c', null)];
    expect(featuredBook(livros, { a: 'reading' })?.id).toBe('b');
  });

  it('sem nenhum livro por comecar, nao ha destaque', () => {
    expect(featuredBook([livro('a', null)], { a: 'finished' })).toBeNull();
  });
});
