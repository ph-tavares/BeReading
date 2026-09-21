import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush, canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

const mockProfile = { user_id: 'u1', display_name: 'Guilherme' };
jest.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ profile: mockProfile }) }));

jest.mock('../../src/api/queries', () => ({ getStudentBooks: jest.fn() }));

const mockConfigurarAudio = jest.fn(() => Promise.resolve());
const mockTocarInicio = jest.fn(() => Promise.resolve());
jest.mock('../../src/features/session/audio', () => ({
  configureSessionAudio: () => mockConfigurarAudio(),
  playStartSound: () => mockTocarInicio(),
}));

const mockArmar = jest.fn(() => Promise.resolve('id-1'));
jest.mock('../../src/features/session/alarm', () => ({
  armEndAlarm: (...args: unknown[]) => mockArmar(...(args as [])),
}));

import SessionStartScreen from '../../app/session/start';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { getStudentBooks } from '../../src/api/queries';
import type { Book, StudentBook } from '../../src/types/database';

const mGetStudentBooks = getStudentBooks as jest.Mock;

const book: Book = {
  id: 'b1', title: 'O Guia do Mochileiro das Galáxias', author: 'Douglas Adams',
  cover_url: null, total_pages: 208, genre: null, created_at: '2026-01-01T00:00:00.000Z',
};

const studentBook: StudentBook = {
  id: 'sb-b1', user_id: 'u1', book_id: 'b1', status: 'reading', current_page: 84,
  started_at: '2026-01-01T00:00:00.000Z', finished_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  useSessionStore.setState({ active: null, lastMode: { kind: 'timed', minutes: 20 }, keepAwake: false, hydrated: true });
  useReadingStore.setState({ currentBook: { studentBook, book } });
  mGetStudentBooks.mockResolvedValue([{ ...studentBook, book }]);
});

describe('tela de escolher o tempo', () => {
  it('comeca a sessao com o tempo escolhido e leva para a sessao', async () => {
    const tela = render(<SessionStartScreen />);

    fireEvent.press(tela.getByText('30 min'));
    fireEvent.press(tela.getByText('Começar a ler'));

    await waitFor(() => {
      expect(useSessionStore.getState().active).toMatchObject({
        mode: { kind: 'timed', minutes: 30 },
        bookId: 'b1',
      });
    });
    expect(mockReplace).toHaveBeenCalledWith('/session');
  });

  /**
   * Criterio de aceite da BER-122: "quem nunca leu nada no app consegue
   * comecar uma sessao (o fluxo nao depende de ter livro na estante)".
   *
   * Interpretacao adotada, e declarada no PR: a tela nao pode dar em nada.
   * Sem livro, ela oferece escolher um — e NAO deixa a sessao comecar sem
   * livro, porque o fim da sessao pergunta ate que pagina se foi, e pagina
   * sem livro nao registra nada.
   */
  it('sem livro na estante, oferece escolher um em vez de travar', async () => {
    useReadingStore.setState({ currentBook: null });
    mGetStudentBooks.mockResolvedValue([]);

    const tela = render(<SessionStartScreen />);

    const escolher = await tela.findByText('Escolher um livro');
    fireEvent.press(escolher);

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/catalogo');
    expect(tela.queryByText('Começar a ler')).toBeNull();
  });

  it('o livro atual vem selecionado e da para trocar', async () => {
    const outro: Book = { ...book, id: 'b2', title: 'Coraline', author: 'Neil Gaiman' };
    mGetStudentBooks.mockResolvedValue([
      { ...studentBook, book },
      { ...studentBook, id: 'sb-b2', book_id: 'b2', book: outro },
    ]);

    const tela = render(<SessionStartScreen />);

    fireEvent.press(await tela.findByText('Trocar'));
    fireEvent.press(await tela.findByText('Coraline'));
    fireEvent.press(tela.getByText('Começar a ler'));

    await waitFor(() => {
      expect(useSessionStore.getState().active).toMatchObject({ bookId: 'b2' });
    });
  });

  it('aceita tempo personalizado e recusa o que nao for minuto valido', async () => {
    const tela = render(<SessionStartScreen />);

    fireEvent.press(tela.getByText('Outro'));
    fireEvent.changeText(tela.getByPlaceholderText('minutos'), '45');
    fireEvent.press(tela.getByText('Começar a ler'));

    await waitFor(() => {
      expect(useSessionStore.getState().active).toMatchObject({ mode: { kind: 'timed', minutes: 45 } });
    });
  });

  /**
   * BER-124: o som de inicio, e a rede embaixo dele, nascem JUNTO com a
   * sessao. Configurar o modo de audio antes de tocar nao e detalhe: sem
   * `playsInSilentMode` e `shouldPlayInBackground`, o sino do fim nao toca no
   * caso que importa, que e o celular no silencioso com a tela apagada.
   */
  it('ao comecar: configura o audio, toca o inicio e arma o alarme de fim', async () => {
    const tela = render(<SessionStartScreen />);

    fireEvent.press(tela.getByText('20 min'));
    fireEvent.press(tela.getByText('Começar a ler'));

    await waitFor(() => {
      expect(useSessionStore.getState().active).not.toBeNull();
    });

    expect(mockConfigurarAudio).toHaveBeenCalled();
    expect(mockTocarInicio).toHaveBeenCalled();
    expect(mockArmar).toHaveBeenCalledWith(
      expect.objectContaining({ endsAt: expect.any(String) }),
    );
  });

  /**
   * A preferencia de manter a tela acesa precisa ter uma porta. Sem ela seria
   * codigo que ninguem alcanca — o mesmo defeito de "conteudo sem destino"
   * que a guarda de rotas documenta, so que dentro de uma tela.
   */
  it('da para ligar "manter a tela acesa", e a escolha fica guardada', async () => {
    const tela = render(<SessionStartScreen />);

    fireEvent.press(tela.getByText('Manter a tela acesa'));

    await waitFor(() => {
      expect(useSessionStore.getState().keepAwake).toBe(true);
    });
  });
});
