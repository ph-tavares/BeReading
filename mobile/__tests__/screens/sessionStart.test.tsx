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

import SessionStartScreen from '../../app/session/start';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useReadingStore } from '../../src/stores/readingStore';
import type { Book, StudentBook } from '../../src/types/database';

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
  useSessionStore.setState({ active: null, lastMode: { kind: 'timed', minutes: 20 }, hydrated: true });
  useReadingStore.setState({ currentBook: { studentBook, book } });
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
});
