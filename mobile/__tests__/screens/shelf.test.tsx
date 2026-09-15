import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    // Mesmo mock de home.test.tsx: dispara uma vez por montagem, sem loop.
    useFocusEffect: (cb: () => void | (() => void)) => {
      react.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: { user_id: 'u1' } }),
}));

let mockEntitlement: any = null;
jest.mock('../../src/stores/entitlementStore', () => ({
  useEntitlementStore: Object.assign(
    (sel: (s: any) => any) => sel({ entitlement: mockEntitlement }),
    { getState: () => ({ refresh: jest.fn() }) },
  ),
}));

jest.mock('../../src/api/queries', () => ({
  getStudentBooks: jest.fn(),
  getMyAnswers: jest.fn(),
  getBookWithChapters: jest.fn(),
}));

import LivrosScreen from '../../app/(tabs)/livros';
import { getStudentBooks, getMyAnswers, getBookWithChapters } from '../../src/api/queries';

const mBooks = getStudentBooks as jest.Mock;
const mAnswers = getMyAnswers as jest.Mock;
const mChapters = getBookWithChapters as jest.Mock;

const livro = (id: string, title: string) => ({
  id, title, author: 'Autora', cover_url: null, total_pages: 200, genre: null, created_at: '2026-01-01',
});
const entrada = (id: string, status: string, current_page: number) => ({
  id: `sb-${id}`, student_id: 'u1', book_id: id, status, current_page, book: livro(id, `Livro ${id}`),
});

async function montar() {
  const tela = render(<LivrosScreen />);
  await act(async () => {});
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEntitlement = null;
  mBooks.mockResolvedValue([entrada('b1', 'reading', 50), entrada('b2', 'finished', 200)]);
  mAnswers.mockResolvedValue([
    { comprehension_score: 90, evaluation_status: 'completed', question: { chapter_id: 'c9' } },
    { comprehension_score: 70, evaluation_status: 'completed', question: { chapter_id: 'c9' } },
  ]);
  mChapters.mockResolvedValue({ ...livro('b2', 'Livro b2'), chapters: [{ id: 'c9' }] });
});

describe('Estante (spec 7.7)', () => {
  it('Lendo mostra a linha do livro com pagina e abre o detalhe', async () => {
    const tela = await montar();
    expect(tela.getByText('Lendo · 1')).toBeTruthy();
    expect(tela.getByText('Autora · pág. 50 de 200')).toBeTruthy();
    fireEvent.press(tela.getByLabelText(/Abrir Livro b1/));
    expect(mockPush).toHaveBeenCalledWith('/book/b1');
  });

  it('Lidos mostra a prateleira com a media do livro', async () => {
    const tela = await montar();
    fireEvent.press(tela.getByText('Lidos · 1'));
    expect(tela.getByText('média 80')).toBeTruthy();
  });

  it('no gratuito, o uso da vaga vira texto no subtitulo', async () => {
    mockEntitlement = { plan: 'free', limits: { max_active_books: 2 } };
    const tela = await montar();
    expect(tela.getByText('1 de 2 livros em leitura')).toBeTruthy();
  });

  it('vazia: lombadas e caminho pra Explorar', async () => {
    mBooks.mockResolvedValue([]);
    const tela = await montar();
    expect(tela.getByText('Sua estante está vazia.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Explorar livros' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/catalogo');
  });

  it('erro ao carregar: banner, sem derrubar a tela', async () => {
    mBooks.mockRejectedValue(new Error('rede'));
    const tela = await montar();
    expect(tela.getByText('Não deu pra carregar sua estante. Puxe pra atualizar.')).toBeTruthy();
  });

  it('falha na media nao esconde os lidos', async () => {
    mAnswers.mockRejectedValue(new Error('rede'));
    const tela = await montar();
    fireEvent.press(tela.getByText('Lidos · 1'));
    expect(tela.getByLabelText('Abrir Livro b2, de Autora.')).toBeTruthy();
    expect(tela.queryByText(/média/)).toBeNull();
  });
});
