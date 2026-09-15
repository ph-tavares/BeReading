import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'b1' }),
}));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: { user_id: 'u1' } }),
}));

jest.mock('../../src/stores/entitlementStore', () => ({
  useEntitlementStore: { getState: () => ({ refresh: jest.fn() }) },
}));

jest.mock('../../src/api/queries', () => ({
  getBookWithChapters: jest.fn(),
  getStudentBookEntry: jest.fn(),
  getMyAnswers: jest.fn(),
}));

jest.mock('../../src/api/edgeFunctions', () => ({
  startReadingBook: jest.fn(),
  stopReadingBook: jest.fn(),
}));

import BookDetailScreen from '../../app/book/[id]';
import { ToastProvider } from '../../src/ui/Toast';
import { getBookWithChapters, getStudentBookEntry, getMyAnswers } from '../../src/api/queries';
import { startReadingBook, stopReadingBook } from '../../src/api/edgeFunctions';

const mBook = getBookWithChapters as jest.Mock;
const mEntry = getStudentBookEntry as jest.Mock;
const mAnswers = getMyAnswers as jest.Mock;
const mStart = startReadingBook as jest.Mock;
const mStop = stopReadingBook as jest.Mock;

const LIVRO = {
  id: 'b1', title: '1984', author: 'George Orwell', cover_url: null, total_pages: 328, genre: 'Distopia',
  created_at: '2026-01-01T00:00:00.000Z',
  chapters: [
    { id: 'c1', book_id: 'b1', number: 1, title: null, start_page: 1, end_page: 30 },
    { id: 'c2', book_id: 'b1', number: 2, title: null, start_page: 31, end_page: 60 },
    { id: 'c3', book_id: 'b1', number: 3, title: null, start_page: 61, end_page: 90 },
  ],
};

async function montar() {
  const tela = render(
    <ToastProvider>
      <BookDetailScreen />
    </ToastProvider>,
  );
  await act(async () => {});
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  mBook.mockResolvedValue(LIVRO);
  mEntry.mockResolvedValue({ status: 'reading', current_page: 45 });
  mAnswers.mockResolvedValue([
    { comprehension_score: 80, evaluation_status: 'completed', question: { chapter_id: 'c1' } },
    { comprehension_score: 60, evaluation_status: 'completed', question: { chapter_id: 'c1' } },
  ]);
  mStop.mockResolvedValue({ status: 'dropped' });
  mStart.mockResolvedValue({ status: 'reading' });
});

describe('Detalhe do livro (spec 7.4)', () => {
  it('carregando: skeleton, nunca spinner', () => {
    mBook.mockReturnValue(new Promise(() => {}));
    const tela = render(
      <ToastProvider>
        <BookDetailScreen />
      </ToastProvider>,
    );
    expect(tela.getAllByLabelText('Carregando').length).toBeGreaterThan(0);
  });

  it('mostra livro, progresso e capitulos com estado', async () => {
    const tela = await montar();
    // A capa gerada tambem escreve titulo e autor: um na capa, um no cabecalho.
    expect(tela.getAllByText('1984')).toHaveLength(2);
    expect(tela.getAllByText('George Orwell')).toHaveLength(2);
    expect(tela.getByText('pág. 45 de 328')).toBeTruthy();
    expect(tela.getByText('média 70')).toBeTruthy();
    expect(tela.getByText('faltam 15 pág.')).toBeTruthy();
    expect(tela.getByText('Leia até a p. 90 pro quiz abrir')).toBeTruthy();
  });

  it('capitulo feito abre o quiz; trancado nao abre', async () => {
    const tela = await montar();
    fireEvent.press(tela.getByRole('button', { name: /Capítulo 1/ }));
    expect(mockPush).toHaveBeenCalledWith('/quiz/c1');
    mockPush.mockClear();
    fireEvent.press(tela.getByRole('button', { name: /Capítulo 3/ }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('barra fixa "Registrar leitura" abre o sheet com o livro', async () => {
    const tela = await montar();
    fireEvent.press(tela.getByRole('button', { name: 'Registrar leitura' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/register-reading', params: { bookId: 'b1' } });
  });

  it('"Tirar da leitura" confirma com o dialogo do sistema antes de tirar', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = await montar();

    fireEvent.press(tela.getByRole('button', { name: 'Tirar da leitura' }));
    expect(mStop).not.toHaveBeenCalled();
    const [titulo, , botoes] = alerta.mock.calls[0];
    expect(titulo).toBe('Tirar da leitura?');
    await act(async () => {
      botoes![1].onPress?.();
    });
    expect(mStop).toHaveBeenCalledWith('b1');
    alerta.mockRestore();
  });

  it('livro tirado da leitura: "Voltar a ler" e sem barra de registrar', async () => {
    mEntry.mockResolvedValue({ status: 'dropped', current_page: 45 });
    const tela = await montar();

    expect(tela.queryByRole('button', { name: 'Registrar leitura' })).toBeNull();
    await act(async () => {
      fireEvent.press(tela.getByRole('button', { name: 'Voltar a ler' }));
    });
    expect(mStart).toHaveBeenCalledWith('b1');
  });

  it('erro ao carregar: diz o que houve e oferece voltar', async () => {
    mBook.mockRejectedValue(new Error('rede'));
    const tela = await montar();

    expect(tela.getByText('Não deu pra abrir esse livro.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
