import { render, fireEvent } from '@testing-library/react-native';
import { CurrentBookHero } from '../../../src/features/home/CurrentBookHero';
import type { Book } from '../../../src/types/database';

const book: Book = {
  id: 'b1',
  title: 'O Guia do Mochileiro das Galáxias',
  author: 'Douglas Adams',
  cover_url: null,
  total_pages: 208,
  genre: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('CurrentBookHero', () => {
  it('mostra titulo, autor e pagina atual', () => {
    const { getByText, getAllByText } = render(
      <CurrentBookHero
        book={book}
        currentPage={84}
        goal={{ chapterNumber: 4, totalChapters: 8, remainingPages: 28 }}
        onPress={jest.fn()}
      />,
    );
    // O titulo aparece duas vezes: uma na capa tipografica gerada pelo Cover
    // (sempre desenhada, mesmo sem cover_url) e outra no cabecalho do hero.
    expect(getAllByText(book.title).length).toBe(2);
    expect(getAllByText(book.author).length).toBeGreaterThanOrEqual(1);
    expect(getByText('pág. 84 de 208')).toBeTruthy();
    expect(getByText('40%')).toBeTruthy();
  });

  it('com meta, mostra capitulo e paginas que faltam', () => {
    const { getByText } = render(
      <CurrentBookHero
        book={book}
        currentPage={84}
        goal={{ chapterNumber: 4, totalChapters: 8, remainingPages: 28 }}
        onPress={jest.fn()}
      />,
    );
    expect(getByText('cap. 4 de 8 · faltam 28 pág. pra fechar')).toBeTruthy();
  });

  // O teste que garante o criterio de aceite central da tarefa: sem capitulo
  // paginado, o numero nao aparece chutado, o bloco inteiro some.
  it('sem meta (livro sem capitulo paginado), a linha de capitulo nao aparece', () => {
    const { queryByText } = render(
      <CurrentBookHero book={book} currentPage={84} goal={null} onPress={jest.fn()} />,
    );
    expect(queryByText(/cap\.\s*\d/)).toBeNull();
    expect(queryByText(/faltam/)).toBeNull();
  });

  it('tocar no hero chama onPress, com role e label de botao', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <CurrentBookHero book={book} currentPage={84} goal={null} onPress={onPress} />,
    );
    const botao = getByRole('button');
    expect(botao.props.accessibilityLabel).toBeTruthy();
    fireEvent.press(botao);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
