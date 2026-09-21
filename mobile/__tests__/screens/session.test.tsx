import { render, act } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

import SessionScreen from '../../app/session/index';
import { useSessionStore } from '../../src/stores/sessionStore';
import { startSession } from '../../src/features/session/logic';

const INICIO = new Date('2026-09-20T22:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('tela da sessao', () => {
  /**
   * O teste que prova a regra central na interface: a sessao comecou 15
   * minutos atras com 20 de tempo. Nenhum tique rodou nesse meio — o app
   * estava congelado, a tela apagada, a pessoa lendo, que e o caso BOM. Ao
   * voltar, o relogio tem que dizer 05:00, e nao 20:00.
   *
   * "O cronometro reinicia quando a tela apaga" e' reclamacao de loja
   * registrada do concorrente Leio. Esta assercao e o que impede o BeReading
   * de ter a mesma.
   */
  it('mostra o tempo que sobrou do instante gravado, sem depender de tique', () => {
    jest.setSystemTime(new Date('2026-09-20T22:15:00.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'timed', minutes: 20 },
      hydrated: true,
    });

    const tela = render(<SessionScreen />);

    expect(tela.getByText('05:00')).toBeTruthy();
  });

  it('a sessao sem tempo definido conta para cima', () => {
    jest.setSystemTime(new Date('2026-09-20T22:03:00.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'open' }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'open' },
      hydrated: true,
    });

    const tela = render(<SessionScreen />);

    expect(tela.getByText('03:00')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(1000); });

    expect(tela.getByText('03:01')).toBeTruthy();
  });
});
