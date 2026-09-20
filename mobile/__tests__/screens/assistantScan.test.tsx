// BER-100: a tela que fotografa a pagina e mostra o que perguntar.
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: { bookId?: string; bookTitle?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

let mockPermissao: { granted: boolean } | null = { granted: true };
const mockPedirPermissao = jest.fn();
const mockTirarFoto = jest.fn();
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useCameraPermissions: () => [mockPermissao, mockPedirPermissao],
    CameraView: React.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTirarFoto }));
      return React.createElement(View, { testID: 'camera' }, props.children);
    }),
  };
});

const mockResize = jest.fn();
const mockSalvar = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const contexto = {
        resize: (alvo: unknown) => { mockResize(alvo); return contexto; },
        renderAsync: async () => ({ saveAsync: mockSalvar }),
      };
      return contexto;
    },
  },
}));

// O modulo real de edgeFunctions entra abaixo por requireActual (para a tela usar
// o ScanPageError de verdade), e ele monta o cliente do Supabase no import.
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const mockScanPage = jest.fn();
jest.mock('../../src/api/edgeFunctions', () => {
  const real = jest.requireActual('../../src/api/edgeFunctions');
  return { ...real, scanPage: (...args: unknown[]) => mockScanPage(...args) };
});

import AssistantScanScreen from '../../app/assistant/scan';
import { ScanPageError } from '../../src/api/edgeFunctions';

const SCAN = {
  conversation_id: 'conv-1',
  page_text: 'Quem controla o passado controla o futuro.',
  suggestions: ['o que é duplipensar', 'me explica esse trecho', 'quem é O\'Brien'],
  detected_page: 220,
  chapter_number: 9,
  registered_page: 200,
  book: { id: 'book-1', title: '1984', author: 'George Orwell' },
  book_title_text: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissao = { granted: true };
  mockParams = { bookId: 'book-1', bookTitle: '1984' };
  mockTirarFoto.mockResolvedValue({ uri: 'file:///foto.jpg', width: 3024, height: 4032 });
  mockSalvar.mockResolvedValue({ base64: 'QUJD', uri: 'file:///menor.jpg' });
  mockScanPage.mockResolvedValue(SCAN);
});

describe('tela da foto', () => {
  it('sem permissao, explica pra que serve a camera antes de pedir', () => {
    mockPermissao = { granted: false };
    const { getByText } = render(<AssistantScanScreen />);

    expect(getByText(/Preciso da câmera/)).toBeTruthy();
    expect(getByText(/não fica salva/)).toBeTruthy();

    fireEvent.press(getByText('Permitir a câmera'));
    expect(mockPedirPermissao).toHaveBeenCalled();
  });

  it('permissao negada nao vira beco sem saida', () => {
    mockPermissao = { granted: false };
    const { getByText } = render(<AssistantScanScreen />);
    fireEvent.press(getByText('Agora não'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('com permissao, mostra o visor e a instrucao do enquadramento', () => {
    const { getByTestId, getByText } = render(<AssistantScanScreen />);
    expect(getByTestId('camera')).toBeTruthy();
    expect(getByText('Enquadre a página inteira, com o número dela.')).toBeTruthy();
  });

  it('fotografar reduz a borda maior, envia e mostra transcricao e sugestoes', async () => {
    const { getByLabelText, getByText } = render(<AssistantScanScreen />);

    fireEvent.press(getByLabelText('Fotografar a página'));

    await waitFor(() => expect(getByText(SCAN.page_text)).toBeTruthy());

    // Retrato de 3024x4032: quem passa do teto e a altura.
    expect(mockResize).toHaveBeenCalledWith({ height: 1500 });
    expect(mockScanPage).toHaveBeenCalledWith({
      imageBase64: 'QUJD',
      imageMediaType: 'image/jpeg',
      bookId: 'book-1',
      bookTitle: '1984',
    });

    expect(getByText('O que eu li na sua foto')).toBeTruthy();
    expect(getByText('Sobre o que você quer falar?')).toBeTruthy();
    for (const sugestao of SCAN.suggestions) expect(getByText(sugestao)).toBeTruthy();
    // O chip diz de onde a conversa fala.
    expect(getByText('1984 · pag. 220')).toBeTruthy();
  });

  it('foto que ja cabe no teto nao e reduzida', async () => {
    mockTirarFoto.mockResolvedValue({ uri: 'file:///foto.jpg', width: 1200, height: 900 });
    const { getByLabelText, getByText } = render(<AssistantScanScreen />);

    fireEvent.press(getByLabelText('Fotografar a página'));
    await waitFor(() => expect(getByText(SCAN.page_text)).toBeTruthy());

    expect(mockResize).not.toHaveBeenCalled();
  });

  it('foto que nao e pagina de livro mostra a fala certa e oferece tentar de novo', async () => {
    mockScanPage.mockRejectedValue(new ScanPageError('not_a_book_page'));
    const { getByLabelText, getByText, getByTestId } = render(<AssistantScanScreen />);

    fireEvent.press(getByLabelText('Fotografar a página'));

    await waitFor(() => expect(getByText(/não parece página de livro/)).toBeTruthy());

    fireEvent.press(getByText('Tirar outra foto'));
    expect(getByTestId('camera')).toBeTruthy();
  });

  it('sem internet, a fala e sobre internet', async () => {
    mockScanPage.mockRejectedValue(new ScanPageError('offline'));
    const { getByLabelText, getByText } = render(<AssistantScanScreen />);

    fireEvent.press(getByLabelText('Fotografar a página'));
    await waitFor(() => expect(getByText(/sem internet/i)).toBeTruthy());
  });

  it('sem livro na estante, a tela nao inventa titulo nem pagina', async () => {
    mockParams = {};
    mockScanPage.mockResolvedValue({
      ...SCAN, book: null, book_title_text: null, detected_page: null, chapter_number: null, registered_page: null,
    });
    const { getByLabelText, getByText, queryByText } = render(<AssistantScanScreen />);

    fireEvent.press(getByLabelText('Fotografar a página'));
    await waitFor(() => expect(getByText(SCAN.page_text)).toBeTruthy());

    expect(queryByText(/pag\./)).toBeNull();
    expect(mockScanPage).toHaveBeenCalledWith({
      imageBase64: 'QUJD',
      imageMediaType: 'image/jpeg',
      bookId: undefined,
      bookTitle: undefined,
    });
  });
});
