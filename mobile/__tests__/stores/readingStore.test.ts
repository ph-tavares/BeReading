import { useReadingStore } from '../../src/stores/readingStore';
import type { CurrentBook } from '../../src/stores/readingStore';
import type { Book, StudentBook } from '../../src/types/database';

const mockBook: Book = {
  id: 'b1', title: '1984', author: 'Orwell', cover_url: null,
  total_pages: 328, genre: 'Distopia', created_at: '2026-01-01',
};
const mockStudentBook: StudentBook = {
  id: 'sb1', student_id: 's1', book_id: 'b1', status: 'reading',
  current_page: 50, started_at: '2026-01-01', finished_at: null,
};
const mockCurrentBook: CurrentBook = { studentBook: mockStudentBook, book: mockBook };

beforeEach(() => {
  useReadingStore.setState({ currentBook: null });
});

describe('useReadingStore', () => {
  it('estado inicial é null', () => {
    expect(useReadingStore.getState().currentBook).toBeNull();
  });

  it('setCurrentBook atualiza o livro atual', () => {
    useReadingStore.getState().setCurrentBook(mockCurrentBook);
    expect(useReadingStore.getState().currentBook).toEqual(mockCurrentBook);
  });

  it('setCurrentBook com null limpa o livro atual', () => {
    useReadingStore.setState({ currentBook: mockCurrentBook });
    useReadingStore.getState().setCurrentBook(null);
    expect(useReadingStore.getState().currentBook).toBeNull();
  });
});
