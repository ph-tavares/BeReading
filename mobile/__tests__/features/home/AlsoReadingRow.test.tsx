import { render, fireEvent } from '@testing-library/react-native';
import { AlsoReadingRow } from '../../../src/features/home/AlsoReadingRow';

const livros = [
  { id: 'b1', title: 'Livro Um', author: 'Autora Um', cover_url: null },
  { id: 'b2', title: 'Livro Dois', author: 'Autora Dois', cover_url: null },
];

describe('AlsoReadingRow', () => {
  it('mostra o rotulo "Também lendo"', () => {
    const { getByText } = render(<AlsoReadingRow books={livros} onPressBook={jest.fn()} />);
    expect(getByText('Também lendo')).toBeTruthy();
  });

  it('renderiza um item tocavel por livro', () => {
    const { getAllByRole } = render(<AlsoReadingRow books={livros} onPressBook={jest.fn()} />);
    expect(getAllByRole('button').length).toBe(livros.length);
  });

  it('tocar num livro chama onPressBook com o id certo', () => {
    const onPressBook = jest.fn();
    const { getAllByRole } = render(<AlsoReadingRow books={livros} onPressBook={onPressBook} />);
    fireEvent.press(getAllByRole('button')[1]);
    expect(onPressBook).toHaveBeenCalledWith('b2');
  });

  it('lista vazia nao renderiza nada', () => {
    const { toJSON } = render(<AlsoReadingRow books={[]} onPressBook={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });
});
