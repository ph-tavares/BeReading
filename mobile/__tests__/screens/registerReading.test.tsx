import { render, fireEvent, act, waitFor, within } from '@testing-library/react-native';
import { BackHandler, Keyboard, StyleSheet } from 'react-native';

// O Skeleton do carregamento usa useReducedMotion, que o mock oficial nao
// traz (mesma sobrescrita local de home.test.tsx).
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
// false simula o sheet aberto como primeira tela (link direto, recarregamento).
let mockCanGoBack = true;
let mockParams: { bookId?: string } = {};
// Opcoes que a tela passa para a propria rota via <Stack.Screen options>, na
// ordem de render: a ultima e a que vale.
const mockStackOptions: { gestureEnabled?: boolean }[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush, canGoBack: () => mockCanGoBack }),
  useLocalSearchParams: () => mockParams,
  Stack: {
    Screen: ({ options }: { options?: { gestureEnabled?: boolean } }) => {
      mockStackOptions.push(options ?? {});
      return null;
    },
  },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const mockProfile = {
  user_id: 'u1', display_name: 'Guilherme', classroom_id: null, created_at: '2026-01-01T00:00:00.000Z',
};
jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ profile: mockProfile }),
}));

let mockCurrentBook: unknown = null;
jest.mock('../../src/stores/readingStore', () => ({
  useReadingStore: () => ({ currentBook: mockCurrentBook }),
}));

jest.mock('../../src/api/queries', () => ({
  getStudentBooks: jest.fn(),
  getBookWithChapters: jest.fn(),
  getReadingSessions: jest.fn(),
  getMyAnswers: jest.fn(),
  getStudentBadges: jest.fn(),
  getStreak: jest.fn(),
}));

jest.mock('../../src/api/edgeFunctions', () => ({
  registerReadingSession: jest.fn(),
}));

import * as Haptics from 'expo-haptics';
import RegisterReadingScreen from '../../app/register-reading';
import { ToastProvider } from '../../src/ui/Toast';
import { useProgressStore } from '../../src/stores/progressStore';
import { getStudentBooks, getBookWithChapters } from '../../src/api/queries';
import { registerReadingSession } from '../../src/api/edgeFunctions';
import type { RegisterReadingResponse } from '../../src/api/edgeFunctions';
import { QuotaExceededError } from '../../src/utils/billing';
import { color } from '../../src/theme/tokens';
import type { Book, Chapter, StudentBook } from '../../src/types/database';

const mGetStudentBooks = getStudentBooks as jest.Mock;
const mGetBookWithChapters = getBookWithChapters as jest.Mock;
const mRegister = registerReadingSession as jest.Mock;
const mNotification = Haptics.notificationAsync as jest.Mock;
const mockRefresh = jest.fn();

const book = (over: Partial<Book> = {}): Book => ({
  id: 'b1', title: 'O Guia do Mochileiro das Galáxias', author: 'Douglas Adams',
  cover_url: null, total_pages: 208, genre: null, created_at: '2026-01-01T00:00:00.000Z', ...over,
});

const entry = (over: Partial<StudentBook> = {}, b: Book = book()) => ({
  id: `sb-${b.id}`, user_id: 'u1', book_id: b.id, status: 'reading' as const, current_page: 84,
  started_at: '2026-01-01T00:00:00.000Z', finished_at: null, book: b, ...over,
});

const chapter = (number: number, start_page: number | null, end_page: number | null, book_id = 'b1'): Chapter => ({
  id: `c-${number}`, book_id, number, title: null, start_page, end_page,
});

// Mockup 04: o leitor parou na 84, o capitulo 4 vai da 85 a 112.
const CAPITULOS = [
  chapter(1, 1, 30), chapter(2, 31, 60), chapter(3, 61, 84), chapter(4, 85, 112), chapter(5, 113, 140),
];

const DOM_CASMURRO = book({ id: 'b2', title: 'Dom Casmurro', author: 'Machado de Assis', total_pages: 256 });

const resposta = (over: Partial<RegisterReadingResponse> = {}): RegisterReadingResponse => ({
  session_created: true, new_max_page: 112, current_streak: 5, longest_streak: 7,
  completed_chapter_ids: [], ...over,
});

async function abrir() {
  const utils = render(
    <ToastProvider>
      <RegisterReadingScreen />
    </ToastProvider>,
  );
  await utils.findByLabelText('Página final');
  // A busca dos capitulos corre depois da escolha do livro: deixa ela assentar.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCurrentBook = null;
  mockCanGoBack = true;
  mockStackOptions.length = 0;

  mGetStudentBooks.mockReset();
  mGetBookWithChapters.mockReset();
  mRegister.mockReset();
  mockRefresh.mockReset();

  mGetStudentBooks.mockResolvedValue([entry()]);
  mGetBookWithChapters.mockResolvedValue({ ...book(), chapters: CAPITULOS });
  mRegister.mockResolvedValue(resposta());
  mockRefresh.mockResolvedValue(undefined);

  useProgressStore.setState({ xp: 0, carregado: false, refresh: mockRefresh });
});

describe('registrar leitura: campos', () => {
  it('o De vem pre-preenchido com current_page + 1, e e editavel', async () => {
    const { getByLabelText } = await abrir();
    expect(getByLabelText('Página inicial').props.value).toBe('85');

    fireEvent.changeText(getByLabelText('Página inicial'), '80');
    expect(getByLabelText('Página inicial').props.value).toBe('80');
  });

  it('o Ate abre em foco, com teclado numerico; o De nao rouba o foco', async () => {
    const { getByLabelText } = await abrir();
    const ate = getByLabelText('Página final');
    expect(ate.props.autoFocus).toBe(true);
    expect(ate.props.keyboardType).toBe('number-pad');
    expect(getByLabelText('Página inicial').props.autoFocus).toBeFalsy();
  });
});

describe('registrar leitura: atalhos', () => {
  it('+10 e +20 preenchem o Ate a partir do De', async () => {
    const { getByLabelText, getByRole } = await abrir();

    fireEvent.press(getByRole('button', { name: '+10' }));
    expect(getByLabelText('Página final').props.value).toBe('94');

    fireEvent.press(getByRole('button', { name: '+20' }));
    expect(getByLabelText('Página final').props.value).toBe('104');
  });

  it('"Fim do cap. X · p. Y" aponta o proximo end_page >= De e preenche o Ate', async () => {
    const { getByLabelText, getByRole, findByRole } = await abrir();

    // Capitulo 3 termina na 84, antes do De (85): o atalho e o do capitulo 4.
    fireEvent.press(await findByRole('button', { name: 'Fim do cap. 4 · p. 112' }));
    expect(getByLabelText('Página final').props.value).toBe('112');

    // Mudou o De, muda o proximo capitulo.
    fireEvent.changeText(getByLabelText('Página inicial'), '113');
    expect(getByRole('button', { name: 'Fim do cap. 5 · p. 140' })).toBeTruthy();
  });

  it('sem capitulo paginado a frente do De, o atalho de fim de capitulo nao aparece', async () => {
    mGetBookWithChapters.mockResolvedValue({
      ...book(),
      chapters: [chapter(1, 1, 30), chapter(2, null, null), chapter(3, 61, 84)],
    });
    const { queryByText, getByRole } = await abrir();

    expect(mGetBookWithChapters).toHaveBeenCalledWith('b1');
    expect(queryByText(/Fim do cap/)).toBeNull();
    // Os atalhos que nao dependem de capitulo continuam.
    expect(getByRole('button', { name: '+10' })).toBeTruthy();
  });
});

describe('registrar leitura: resumo ao vivo', () => {
  it('mostra paginas e XP previsto', async () => {
    const { getByLabelText, getByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');

    expect(getByText('28')).toBeTruthy();
    expect(getByText('+140 XP')).toBeTruthy();
  });

  it('avisa "fecha o capitulo X" so quando o Ate alcanca o end_page', async () => {
    const { getByLabelText, queryByText, getByText } = await abrir();

    fireEvent.changeText(getByLabelText('Página final'), '111');
    expect(queryByText(/fecha o/)).toBeNull();

    fireEvent.changeText(getByLabelText('Página final'), '112');
    expect(getByText('fecha o capítulo 4')).toBeTruthy();
  });

  it('com mais de um capitulo previsto, o aviso nomeia todos', async () => {
    const { getByLabelText, getByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '140');
    expect(getByText('fecha os capítulos 4 e 5')).toBeTruthy();
  });

  it('a nota de paginas repetidas aparece antes do envio, em accentSoft', async () => {
    const { getByLabelText, getByTestId, queryByTestId } = await abrir();

    fireEvent.changeText(getByLabelText('Página final'), '90');
    expect(queryByTestId('nota-repetidas')).toBeNull();

    fireEvent.changeText(getByLabelText('Página inicial'), '80');
    const nota = getByTestId('nota-repetidas');
    expect(StyleSheet.flatten(nota.props.style).backgroundColor).toBe(color.accentSoft);
    expect(
      within(nota).getByText(
        '5 páginas desse trecho você já tinha registrado, e elas não contam XP de novo. Seu progresso tá na pág. 84.',
      ),
    ).toBeTruthy();
    expect(mRegister).not.toHaveBeenCalled();
  });
});

describe('registrar leitura: CTA', () => {
  it('valido: "Registrar N paginas"', async () => {
    const { getByLabelText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    const cta = getByRole('button', { name: 'Registrar 28 páginas' });
    expect(cta.props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('sem o Ate: desabilitado, com o motivo visivel', async () => {
    const { getByText, getByRole } = await abrir();
    expect(getByText('Diz até onde você foi.')).toBeTruthy();

    const cta = getByRole('button', { name: /Registrar leitura/ });
    expect(cta.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(cta);
    expect(mRegister).not.toHaveBeenCalled();
  });

  it('invalido pela validacao: desabilitado, com o motivo de validatePageRange', async () => {
    const { getByLabelText, getByText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '300');

    expect(getByText('Página final excede o total de páginas do livro')).toBeTruthy();
    const cta = getByRole('button', { name: /Registrar leitura/ });
    expect(cta.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(cta);
    expect(mRegister).not.toHaveBeenCalled();
  });
});

describe('registrar leitura: resultado', () => {
  it('com capitulo fechado: espera o refresh e vai para chapter-complete com o contrato F4-7', async () => {
    useProgressStore.setState({ xp: 1840, carregado: true });
    let liberarRefresh: () => void = () => {};
    mockRefresh.mockImplementation(
      () =>
        new Promise<void>((res) => {
          // O refresh muda o XP: se o sheet lesse o XP depois do envio, o
          // xpBefore sairia 1980.
          useProgressStore.setState({ xp: 1980 });
          liberarRefresh = res;
        }),
    );
    // Ordem da resposta preservada de proposito, fora da ordem de numero.
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: ['c-5', 'c-4'], current_streak: 5 }));

    const { getByLabelText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '140');
    fireEvent.press(getByRole('button', { name: 'Registrar 56 páginas' }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('u1'));
    expect(mRegister).toHaveBeenCalledWith('u1', 'b1', 85, 140);
    expect(mockReplace).not.toHaveBeenCalled();
    // F4-18: o "pronto" que a mao sente so vem quando o sheet ja vai sair.
    expect(mNotification).not.toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);

    await act(async () => {
      liberarRefresh();
    });

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/chapter-complete',
        params: { chapterIds: 'c-5,c-4', bookId: 'b1', pagesRead: '56', streak: '5', xpBefore: '1840' },
      }),
    );
    expect(mockBack).not.toHaveBeenCalled();
    expect(mNotification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('store nao carregado: xpBefore fica de fora dos params', async () => {
    mockRefresh.mockImplementation(async () => {
      useProgressStore.setState({ xp: 1980, carregado: true });
    });
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: ['c-4'] }));

    const { getByLabelText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const { params } = mockReplace.mock.calls[0][0];
    expect(params).not.toHaveProperty('xpBefore');
    expect(params).toEqual({ chapterIds: 'c-4', bookId: 'b1', pagesRead: '28', streak: '5' });
  });

  it('BER-68: com paginas relidas, o pagesRead leva so as novas, que sao as que contam XP', async () => {
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: ['c-4'] }));

    const { getByLabelText, getByRole } = await abrir();
    // Parou na 84: de 80 a 112 sao 33 paginas, 5 relidas (80 a 84) e 28 novas.
    fireEvent.changeText(getByLabelText('Página inicial'), '80');
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 33 páginas' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace.mock.calls[0][0].params.pagesRead).toBe('28');
  });

  it('BER-58: 402 de livros em leitura vira convite ao Premium, sem "Tentar" e com os campos intactos', async () => {
    mRegister.mockRejectedValue(
      new QuotaExceededError({ reason: 'active_books', limit: 2, used: 2, resets_at: null }),
    );

    const { getByLabelText, getByRole, findByText, queryByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    expect(await findByText('Você já está lendo 2 livros')).toBeTruthy();
    expect(queryByText('Tentar')).toBeNull();
    expect(queryByText('Não deu pra registrar sua leitura.')).toBeNull();
    expect(getByLabelText('Página final').props.value).toBe('96');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();

    fireEvent.press(getByRole('button', { name: /Conhecer o Premium/ }));
    expect(mockPush).toHaveBeenCalledWith('/planos');
  });

  it('aberto como primeira tela: sem capitulo fechado, vai para a Hoje em vez de GO_BACK sem destino (R2)', async () => {
    mockCanGoBack = false;
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: [] }));

    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    expect(await findByText('12 páginas registradas')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('aberto como primeira tela: tem "Voltar" para sair, que leva para a Hoje (R2)', async () => {
    mockCanGoBack = false;
    const { getByRole } = await abrir();

    fireEvent.press(getByRole('button', { name: 'Voltar' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('aberto por cima da Hoje (sheet), nao mostra "Voltar": o sheet fecha pelo gesto', async () => {
    const { queryByRole } = await abrir();
    expect(queryByRole('button', { name: 'Voltar' })).toBeNull();
  });

  it('aberto como primeira tela e enviando: "Voltar" continua no lugar, mas nao sai (conteudo nao pula) (R2)', async () => {
    mockCanGoBack = false;
    mRegister.mockImplementation(() => new Promise(() => {}));

    const { getByLabelText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    await waitFor(() => expect(mRegister).toHaveBeenCalled());
    fireEvent.press(getByRole('button', { name: 'Voltar' }));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sem capitulo fechado: espera o refresh, fecha o sheet e mostra toast com paginas, XP e sequencia', async () => {
    let liberarRefresh: () => void = () => {};
    mockRefresh.mockImplementation(() => new Promise<void>((res) => { liberarRefresh = res; }));
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: [], current_streak: 5 }));

    const { getByLabelText, getByRole, findByText, queryByText, getByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith('u1'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(queryByText('12 páginas registradas')).toBeNull();
    expect(mNotification).not.toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);

    await act(async () => {
      liberarRefresh();
    });

    expect(await findByText('12 páginas registradas')).toBeTruthy();
    expect(getByText('+60 XP · 5 dias seguidos')).toBeTruthy();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mNotification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('a previsao nao decide: aviso de "fecha o capitulo" com resposta vazia vira toast', async () => {
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: [] }));
    const { getByLabelText, getByRole, getByText, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    expect(getByText('fecha o capítulo 4')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    expect(await findByText('28 páginas registradas')).toBeTruthy();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('a previsao nao decide: sem aviso, mas com capitulo na resposta, vai para chapter-complete', async () => {
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: ['c-4'] }));
    const { getByLabelText, getByRole, queryByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '100');
    expect(queryByText(/fecha o/)).toBeNull();

    fireEvent.press(getByRole('button', { name: 'Registrar 16 páginas' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace.mock.calls[0][0].params.chapterIds).toBe('c-4');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('refresh que falha nao bloqueia o resultado', async () => {
    mockRefresh.mockRejectedValue(new Error('sem rede'));
    mRegister.mockResolvedValue(resposta({ completed_chapter_ids: [] }));
    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    expect(await findByText('12 páginas registradas')).toBeTruthy();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('erro de envio: toast com "Tentar", campos preservados, e "Tentar" reenvia', async () => {
    mRegister
      .mockRejectedValueOnce(new Error('Edge Function returned a non-2xx status code'))
      .mockResolvedValueOnce(resposta({ completed_chapter_ids: [] }));

    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    expect(await findByText('Não deu pra registrar sua leitura.')).toBeTruthy();
    expect(getByLabelText('Página inicial').props.value).toBe('85');
    expect(getByLabelText('Página final').props.value).toBe('112');
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mNotification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    fireEvent.press(getByRole('button', { name: 'Tentar' }));

    expect(await findByText('28 páginas registradas')).toBeTruthy();
    expect(mRegister).toHaveBeenCalledTimes(2);
    expect(mRegister).toHaveBeenNthCalledWith(2, 'u1', 'b1', 85, 112);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('dois toques seguidos no CTA registram uma vez so', async () => {
    mRegister.mockReturnValue(new Promise(() => {}));
    const { getByLabelText, getByRole } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    const cta = getByRole('button', { name: 'Registrar 28 páginas' });
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(mRegister).toHaveBeenCalledTimes(1);
  });
});

describe('registrar leitura: escolha do livro (BER-44)', () => {
  it('"Trocar livro" troca o livro, refaz o De, busca os capitulos dele e registra nele', async () => {
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }), entry({ current_page: 40 }, DOM_CASMURRO)]);
    mGetBookWithChapters.mockImplementation(async (id: string) =>
      id === 'b2'
        ? { ...DOM_CASMURRO, chapters: [chapter(1, 1, 50, 'b2')] }
        : { ...book(), chapters: CAPITULOS },
    );

    const { getByLabelText, getByRole, findByRole, getByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '100');

    fireEvent.press(getByRole('button', { name: 'Trocar livro' }));
    fireEvent.press(getByRole('button', { name: 'Escolher Dom Casmurro' }));

    expect(await findByRole('button', { name: 'Fim do cap. 1 · p. 50' })).toBeTruthy();
    expect(getByText('Dom Casmurro')).toBeTruthy();
    expect(getByLabelText('Página inicial').props.value).toBe('41');
    expect(getByLabelText('Página final').props.value).toBe('');
    expect(mGetBookWithChapters).toHaveBeenLastCalledWith('b2');

    fireEvent.changeText(getByLabelText('Página final'), '50');
    fireEvent.press(getByRole('button', { name: 'Registrar 10 páginas' }));
    await waitFor(() => expect(mRegister).toHaveBeenCalledWith('u1', 'b2', 41, 50));
  });

  it('com um livro so, nao oferece troca', async () => {
    const { queryByRole } = await abrir();
    expect(queryByRole('button', { name: 'Trocar livro' })).toBeNull();
  });

  it('o bookId da rota escolhe o livro, mesmo nao sendo o primeiro', async () => {
    mockParams = { bookId: 'b2' };
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }), entry({ current_page: 40 }, DOM_CASMURRO)]);
    const { getByLabelText, getByText } = await abrir();
    expect(getByText('Dom Casmurro')).toBeTruthy();
    expect(getByLabelText('Página inicial').props.value).toBe('41');
  });
});

describe('registrar leitura: estados', () => {
  it('carregando: skeleton, sem campo ainda', async () => {
    mGetStudentBooks.mockReturnValue(new Promise(() => {}));
    const { getAllByLabelText, queryByLabelText } = render(
      <ToastProvider>
        <RegisterReadingScreen />
      </ToastProvider>,
    );
    expect(getAllByLabelText('Carregando').length).toBeGreaterThan(0);
    expect(queryByLabelText('Página final')).toBeNull();
  });

  it('sem livro em andamento: estado vazio com saida pro catalogo', async () => {
    mGetStudentBooks.mockResolvedValue([]);
    const { findByRole } = render(
      <ToastProvider>
        <RegisterReadingScreen />
      </ToastProvider>,
    );
    fireEvent.press(await findByRole('button', { name: 'Ver catálogo' }));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/catalogo');
  });

  it('falha ao buscar os livros sem livro de reserva: banner com tentar de novo', async () => {
    mGetStudentBooks.mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValueOnce([entry()]);
    const { findByText, getByRole, findByLabelText } = render(
      <ToastProvider>
        <RegisterReadingScreen />
      </ToastProvider>,
    );
    expect(await findByText('Não deu pra carregar seus livros.')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Tentar de novo' }));
    expect((await findByLabelText('Página inicial')).props.value).toBe('85');
    expect(mGetStudentBooks).toHaveBeenCalledTimes(2);
  });

  it('falha ao buscar os livros com o livro que a Hoje abriu: usa ele', async () => {
    mockCurrentBook = { studentBook: entry({ current_page: 20 }), book: book() };
    mGetStudentBooks.mockRejectedValue(new Error('rede caiu'));
    const { findByLabelText } = render(
      <ToastProvider>
        <RegisterReadingScreen />
      </ToastProvider>,
    );
    expect((await findByLabelText('Página inicial')).props.value).toBe('21');
  });
});


// Rodada de correcao 1 (Ruling F4-18 e Relevante 1 da revisao da Tarefa 5).
describe('registrar leitura: durante e depois do envio', () => {
  const espioes: jest.SpyInstance[] = [];
  afterEach(() => {
    espioes.splice(0).forEach((e) => e.mockRestore());
  });

  /** Envio que so termina quando o teste manda. */
  function envioPendente() {
    let resolver: (r: RegisterReadingResponse) => void = () => {};
    let rejeitar: (e: Error) => void = () => {};
    mRegister.mockImplementation(
      () =>
        new Promise<RegisterReadingResponse>((res, rej) => {
          resolver = res;
          rejeitar = rej;
        }),
    );
    return {
      resolver: (r: RegisterReadingResponse) => resolver(r),
      rejeitar: (e: Error) => rejeitar(e),
    };
  }

  const ultimaOpcao = () => mockStackOptions[mockStackOptions.length - 1];

  // Relevante 1: o Ate abre em foco e o toque no CTA nao fecha o teclado
  // (keyboardShouldPersistTaps). Com o number pad aberto, o toast de erro,
  // a ~110 pt do fundo, fica atras da janela do teclado.
  it('fecha o teclado antes de enviar', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    espioes.push(dismiss);
    mRegister.mockRejectedValueOnce(new Error('falhou'));

    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    await findByText('Não deu pra registrar sua leitura.');
    expect(dismiss).toHaveBeenCalled();
    expect(dismiss.mock.invocationCallOrder[0]).toBeLessThan(mRegister.mock.invocationCallOrder[0]);
  });

  it('enquanto envia, o sheet nao fecha por gesto; depois da falha, volta a fechar', async () => {
    const envio = envioPendente();
    const { getByLabelText, getByRole, findByText } = await abrir();
    expect(ultimaOpcao()).toEqual({ gestureEnabled: true });

    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));
    expect(ultimaOpcao()).toEqual({ gestureEnabled: false });

    await act(async () => {
      envio.rejeitar(new Error('falhou'));
    });
    await findByText('Não deu pra registrar sua leitura.');
    expect(ultimaOpcao()).toEqual({ gestureEnabled: true });
  });

  it('enquanto envia, o voltar do Android nao fecha o sheet', async () => {
    const registros: { handler: () => boolean | null | undefined; ativo: boolean }[] = [];
    espioes.push(
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation((evento, handler) => {
        const registro = { handler, ativo: evento === 'hardwareBackPress' };
        registros.push(registro);
        return { remove: () => { registro.ativo = false; } };
      }),
    );
    const ativos = () => registros.filter((r) => r.ativo);

    const envio = envioPendente();
    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    expect(ativos()).toHaveLength(0);

    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));
    expect(ativos()).toHaveLength(1);
    // true = "tratei o voltar": a navegacao nao desempilha o sheet.
    expect(ativos()[0].handler()).toBe(true);

    await act(async () => {
      envio.rejeitar(new Error('falhou'));
    });
    await findByText('Não deu pra registrar sua leitura.');
    expect(ativos()).toHaveLength(0);
  });

  it('enquanto envia, Trocar, campos e atalhos ficam desabilitados, e voltam depois da falha', async () => {
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }), entry({ current_page: 40 }, DOM_CASMURRO)]);
    const envio = envioPendente();
    const { getByLabelText, getByRole, queryByRole, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    const trocar = getByRole('button', { name: 'Trocar livro' });
    expect(trocar.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(trocar);
    expect(queryByRole('button', { name: 'Escolher Dom Casmurro' })).toBeNull();

    const mais10 = getByRole('button', { name: '+10' });
    expect(mais10.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(mais10);
    expect(getByLabelText('Página final').props.value).toBe('112');

    expect(getByLabelText('Página inicial').props.editable).toBe(false);
    expect(getByLabelText('Página final').props.editable).toBe(false);
    fireEvent.changeText(getByLabelText('Página inicial'), '1');
    expect(getByLabelText('Página inicial').props.value).toBe('85');

    await act(async () => {
      envio.rejeitar(new Error('falhou'));
    });
    await findByText('Não deu pra registrar sua leitura.');
    expect(getByRole('button', { name: 'Trocar livro' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    expect(getByRole('button', { name: '+10' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    expect(getByLabelText('Página final').props.editable).not.toBe(false);
    // O que o toast promete ("continua aqui") e verdade.
    expect(getByLabelText('Página inicial').props.value).toBe('85');
    expect(getByLabelText('Página final').props.value).toBe('112');
  });

  it('sheet fechado no meio do envio, com capitulo na resposta: nao navega, e confirma o registro', async () => {
    const envio = envioPendente();
    const { getByLabelText, getByRole, rerender, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    rerender(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      envio.resolver(resposta({ completed_chapter_ids: ['c-4'] }));
    });

    expect(await findByText('28 páginas registradas')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledWith('u1');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('sheet fechado no meio do envio, sem capitulo: nao chama back(), e confirma o registro', async () => {
    const envio = envioPendente();
    const { getByLabelText, getByRole, rerender, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '96');
    fireEvent.press(getByRole('button', { name: 'Registrar 12 páginas' }));

    rerender(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      envio.resolver(resposta({ completed_chapter_ids: [] }));
    });

    expect(await findByText('12 páginas registradas')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('"Tentar" depois de a tela sair nao reenvia', async () => {
    mRegister.mockRejectedValueOnce(new Error('falhou'));
    const { getByLabelText, getByRole, rerender, findByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));
    await findByText('Não deu pra registrar sua leitura.');

    rerender(<ToastProvider>{null}</ToastProvider>);
    fireEvent.press(getByRole('button', { name: 'Tentar' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mRegister).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falha depois de a tela sair: avisa o erro, sem oferecer "Tentar" nem prometer campo guardado', async () => {
    const envio = envioPendente();
    const { getByLabelText, getByRole, rerender, findByText, queryByRole, queryByText } = await abrir();
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    rerender(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      envio.rejeitar(new Error('falhou'));
    });

    expect(await findByText('Não deu pra registrar sua leitura.')).toBeTruthy();
    expect(queryByRole('button', { name: 'Tentar' })).toBeNull();
    expect(queryByText('O que você digitou continua aqui.')).toBeNull();
  });

  // Mesmo defeito do Menor 10 por outra porta: com a lista de livros ja aberta
  // quando o CTA e tocado, escolher outro livro no meio do envio zerava os
  // campos que o toast de erro promete guardar.
  it('com a lista de livros aberta, as linhas dela tambem travam enquanto envia', async () => {
    mGetStudentBooks.mockResolvedValue([entry({ current_page: 84 }), entry({ current_page: 40 }, DOM_CASMURRO)]);
    const envio = envioPendente();
    const { getByLabelText, getByRole, findByText } = await abrir();
    fireEvent.press(getByRole('button', { name: 'Trocar livro' }));
    fireEvent.changeText(getByLabelText('Página final'), '112');
    fireEvent.press(getByRole('button', { name: 'Registrar 28 páginas' }));

    const linha = getByRole('button', { name: 'Escolher Dom Casmurro' });
    expect(linha.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(linha);
    expect(getByLabelText('Página inicial').props.value).toBe('85');
    expect(getByLabelText('Página final').props.value).toBe('112');

    await act(async () => {
      envio.rejeitar(new Error('falhou'));
    });
    await findByText('Não deu pra registrar sua leitura.');
    expect(getByRole('button', { name: 'Escolher Dom Casmurro' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    expect(getByLabelText('Página final').props.value).toBe('112');
  });
});
