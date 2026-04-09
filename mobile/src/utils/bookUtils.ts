import type { StudentBook, Book } from '../types/database';

export interface BookSections {
  reading: (StudentBook & { book: Book })[];
  finished: (StudentBook & { book: Book })[];
}

export function sectionBooksByStatus(
  books: (StudentBook & { book: Book })[],
): BookSections {
  return {
    reading: books.filter((b) => b.status === 'reading'),
    finished: books.filter((b) => b.status === 'finished'),
  };
}
