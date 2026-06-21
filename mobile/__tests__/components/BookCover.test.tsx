import { render } from '@testing-library/react-native';
import { BookCover } from '../../src/components/BookCover';
import type { Book } from '../../src/types/database';

const bookBase: Book = {
  id: 'abc-123',
  title: 'O Livro',
  author: 'Autor',
  total_pages: 200,
  cover_url: null as any,
  genre: null,
  created_at: '',
} as any;

describe('BookCover', () => {
  it('renders emblem fallback when cover_url is null', () => {
    const { queryByTestId } = render(<BookCover book={bookBase} size="md" />);
    expect(queryByTestId('book-cover-emblem')).toBeTruthy();
    expect(queryByTestId('book-cover-image')).toBeFalsy();
  });

  it('renders Image when cover_url is present', () => {
    const { queryByTestId } = render(
      <BookCover book={{ ...bookBase, cover_url: 'https://x/y.jpg' } as any} size="md" />,
    );
    expect(queryByTestId('book-cover-image')).toBeTruthy();
    expect(queryByTestId('book-cover-emblem')).toBeFalsy();
  });

  it('produces identical emblem for same book id (deterministic)', () => {
    const a = render(<BookCover book={bookBase} size="md" />);
    const b = render(<BookCover book={bookBase} size="md" />);
    const aStyle = a.getByTestId('book-cover-emblem').props.style;
    const bStyle = b.getByTestId('book-cover-emblem').props.style;
    // Procura backgroundColor em array ou objeto
    const extractBg = (s: any): string | undefined => {
      if (!s) return undefined;
      if (Array.isArray(s)) {
        for (const item of s) {
          const bg = extractBg(item);
          if (bg) return bg;
        }
        return undefined;
      }
      return s.backgroundColor;
    };
    expect(extractBg(aStyle)).toBe(extractBg(bStyle));
    expect(extractBg(aStyle)).toBeTruthy();
  });
});
