import { render, fireEvent, act, waitFor, within } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: { user_id: 'u1' }, profileStatus: 'ready' }),
}));

jest.mock('../../src/stores/entitlementStore', () => ({
  useEntitlementStore: { getState: () => ({ refresh: jest.fn() }) },
}));

jest.mock('../../src/api/queries', () => ({
  getBooks: jest.fn(),
  getStudentBooks: jest.fn(),
}));

jest.mock('../../src/api/edgeFunctions', () => ({
  startReadingBook: jest.fn(),
}));

import CatalogoScreen from '../../app/(tabs)/catalogo';
import { ToastProvider } from '../../src/ui/Toast';
import { getBooks, getStudentBooks } from '../../src/api/queries';
import { startReadingBook } from '../../src/api/edgeFunctions';

const mBooks = getBooks as jest.Mock;
const mMine = getStudentBooks as jest.Mock;
const mStart = startReadingBook as jest.Mock;

const livro = (id: string, title: string, genre: string | null) => ({
  id, title, author: `Autor ${id}`, cover_url: null, total_pages: 100, genre, created_at: '2026-01-01',
});
const CATALOGO = [
  livro('a', 'Admirável Mundo Novo', 'Distopia'),
  livro('b', 'Brás Cubas', 'Romance'),
  livro('c', 'Capitães da Areia', 'Romance'),
  livro('d', 'Dom Casmurro', 'Romance'),
];

async function montar() {
  const tela = render(
    <ToastProvider>
      <CatalogoScreen />
    </ToastProvider>,
  );
  await act(async () => {});
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  mBooks.mockResolvedValue(CATALOGO);
  mMine.mockResolvedValue([
    { book_id: 'a', status: 'reading' },
    { book_id: 'd', status: 'finished' },
  ]);
  mStart.mockResolvedValue({ status: 'reading' });
});

describe('Explorar (spec 7.8)', () => {
  it('destaque e o primeiro livro nao comecado, e as linhas dizem o estado', async () => {
    const tela = await montar();
    const destaque = within(tela.getByTestId('explorar-destaque'));
    expect(destaque.getAllByText('Brás Cubas').length).toBeGreaterThan(0);
    expect(tela.getByText('Lendo')).toBeTruthy();
    expect(tela.getByText('Lido')).toBeTruthy();
    expect(tela.getByLabelText('Começar Capitães da Areia')).toBeTruthy();
  });

  it('chips vem dos generos reais e filtram a lista', async () => {
    const tela = await montar();
    fireEvent.press(tela.getByText('Distopia'));
    expect(tela.queryByTestId('explorar-destaque')).toBeNull();
    expect(tela.getByLabelText('Abrir Admirável Mundo Novo, de Autor a.')).toBeTruthy();
    expect(tela.queryByLabelText('Abrir Dom Casmurro, de Autor d.')).toBeNull();
  });

  it('comecar poe na estante com toast e muda o estado da linha', async () => {
    const tela = await montar();
    await act(async () => { fireEvent.press(tela.getByLabelText('Começar Capitães da Areia')); });
    expect(mStart).toHaveBeenCalledWith('c');
    expect(tela.getByText('Capitães da Areia entrou na sua estante.')).toBeTruthy();
    expect(tela.queryByLabelText('Começar Capitães da Areia')).toBeNull();
    expect(tela.getAllByText('Lendo')).toHaveLength(2);
  });

  it('erro ao comecar vira toast, sem Alert', async () => {
    mStart.mockRejectedValue(new Error('rede'));
    const tela = await montar();
    await act(async () => { fireEvent.press(tela.getByLabelText('Começar Capitães da Areia')); });
    expect(tela.getByText('Não deu pra começar esse livro.')).toBeTruthy();
  });

  it('busca por titulo ou autor com debounce', async () => {
    const tela = await montar();
    fireEvent.changeText(tela.getByLabelText('Buscar'), 'casmurro');
    await waitFor(() => expect(mBooks).toHaveBeenCalledWith('casmurro'), { timeout: 1500 });
  });

  it('lista vazia na busca diz o que houve', async () => {
    const tela = await montar();
    mBooks.mockResolvedValue([]);
    fireEvent.changeText(tela.getByLabelText('Buscar'), 'xyz');
    await waitFor(() => expect(tela.getByText('Nada com esse nome por aqui.')).toBeTruthy(), { timeout: 1500 });
  });
});
