import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Cover } from '../../src/ui/Cover';
import type { Book } from '../../src/types/database';

const livro: Book = {
  id: '00000000-0000-0000-0001-000000000001',
  title: 'O Guia do Mochileiro das Galáxias',
  author: 'Douglas Adams',
  cover_url: null,
  total_pages: 215,
  genre: 'Ficção Científica',
  created_at: '',
};

describe('Cover', () => {
  it('sem cover_url, desenha a capa gerada com titulo e autor', () => {
    const { getByTestId, getByText } = render(<Cover book={livro} size="md" />);
    expect(getByTestId('cover-generated')).toBeTruthy();
    expect(getByText('O Guia do Mochileiro das Galáxias')).toBeTruthy();
    expect(getByText('Douglas Adams')).toBeTruthy();
  });

  it('com cover_url, a capa real entra por cima da gerada', () => {
    const { getByTestId } = render(
      <Cover book={{ ...livro, cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg' }} size="md" />,
    );
    expect(getByTestId('cover-real')).toBeTruthy();
    // A gerada continua atras: e ela que aparece enquanto a imagem carrega.
    expect(getByTestId('cover-generated')).toBeTruthy();
    // So os dois testID existirem nao prova o empilhamento: teria passado
    // igual com a ordem invertida no JSX ou sem o position absolute. O que
    // prova a gerada ficar atras, como placeholder, e a real estar ancorada
    // em cima dela via position absolute no canto 0,0.
    const real = StyleSheet.flatten(getByTestId('cover-real').props.style);
    expect(real.position).toBe('absolute');
    expect(real.top).toBe(0);
    expect(real.left).toBe(0);
  });

  it('a capa inteira e um so elemento para o leitor de tela', () => {
    const { getByLabelText } = render(<Cover book={livro} size="sm" />);
    expect(getByLabelText('O Guia do Mochileiro das Galáxias, de Douglas Adams')).toBeTruthy();
  });

  it('mantem a proporcao 2:3 em todos os tamanhos', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const { getByTestId } = render(<Cover book={livro} size={size} />);
      // StyleSheet.flatten, nunca helper artesanal: um id registrado por
      // StyleSheet.create faria um Object.assign manual devolver {} e o
      // teste passaria sem testar nada.
      const flat = StyleSheet.flatten(getByTestId('cover-generated').props.style);
      expect(flat.height / flat.width).toBeCloseTo(1.5, 1);
    }
  });

  it('no tamanho xs some o texto, porque 48px nao comporta titulo legivel', () => {
    const { queryByText } = render(<Cover book={livro} size="xs" />);
    expect(queryByText('Douglas Adams')).toBeNull();
  });

  it('width tem precedencia sobre size, para os tamanhos que a spec pede (52, 86, 100)', () => {
    const { getByTestId } = render(<Cover book={livro} size="lg" width={86} />);
    const flat = StyleSheet.flatten(getByTestId('cover-generated').props.style);
    expect(flat.width).toBe(86);
  });

  it('mantem a proporcao 2:3 com width arbitrario', () => {
    for (const width of [52, 86, 100]) {
      const { getByTestId } = render(<Cover book={livro} width={width} />);
      const flat = StyleSheet.flatten(getByTestId('cover-generated').props.style);
      expect(flat.width).toBe(width);
      expect(flat.height / flat.width).toBeCloseTo(1.5, 1);
    }
  });
});
