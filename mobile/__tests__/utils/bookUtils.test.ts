import { sectionBooksByStatus } from '../../src/utils/bookUtils';
import type { StudentBook, Book } from '../../src/types/database';

function makeEntry(
  id: string,
  status: 'reading' | 'finished',
): StudentBook & { book: Book } {
  return {
    id: `sb-${id}`,
    user_id: 'u1',
    book_id: id,
    status,
    current_page: 1,
    started_at: '2026-01-01',
    finished_at: null,
    book: {
      id,
      title: `Book ${id}`,
      author: 'Author',
      cover_url: null,
      total_pages: 100,
      genre: null,
      created_at: '2026-01-01',
    },
  };
}

describe('sectionBooksByStatus', () => {
  it('retorna seções vazias para lista vazia', () => {
    const { reading, finished } = sectionBooksByStatus([]);
    expect(reading).toHaveLength(0);
    expect(finished).toHaveLength(0);
  });

  it('separa livros por status corretamente', () => {
    const books = [
      makeEntry('1', 'reading'),
      makeEntry('2', 'finished'),
      makeEntry('3', 'reading'),
    ];
    const { reading, finished } = sectionBooksByStatus(books);
    expect(reading).toHaveLength(2);
    expect(finished).toHaveLength(1);
  });

  it('retorna todos em reading quando todos estão lendo', () => {
    const books = [makeEntry('1', 'reading'), makeEntry('2', 'reading')];
    const { reading, finished } = sectionBooksByStatus(books);
    expect(reading).toHaveLength(2);
    expect(finished).toHaveLength(0);
  });

  it('retorna todos em finished quando todos estão finalizados', () => {
    const books = [makeEntry('1', 'finished'), makeEntry('2', 'finished')];
    const { reading, finished } = sectionBooksByStatus(books);
    expect(reading).toHaveLength(0);
    expect(finished).toHaveLength(2);
  });

  it('preserva a referência dos objetos originais', () => {
    const entry = makeEntry('1', 'reading');
    const { reading } = sectionBooksByStatus([entry]);
    expect(reading[0]).toBe(entry);
  });
});
