import { render, act, fireEvent, waitFor } from '@testing-library/react-native';

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

const mockAtivarTela = jest.fn(() => Promise.resolve());
const mockDesativarTela = jest.fn();
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (...a: unknown[]) => mockAtivarTela(...(a as [])),
  deactivateKeepAwake: (...a: unknown[]) => mockDesativarTela(...(a as [])),
}));

const mockTocarFim = jest.fn(() => Promise.resolve());
const mockTocarParada = jest.fn(() => Promise.resolve());
jest.mock('../../src/features/session/audio', () => ({
  playEndSound: () => mockTocarFim(),
  playStopSound: () => mockTocarParada(),
}));

const mockArmar = jest.fn(() => Promise.resolve('id-1'));
const mockDesarmar = jest.fn(() => Promise.resolve());
jest.mock('../../src/features/session/alarm', () => ({
  armEndAlarm: (...a: unknown[]) => mockArmar(...(a as [])),
  disarmEndAlarm: () => mockDesarmar(),
}));

jest.mock('../../src/stores/authStore', () => ({ useAuthStore: () => ({ profile: { user_id: 'u1' } }) }));
jest.mock('../../src/api/queries', () => ({
  getStudentBooks: jest.fn(() => Promise.resolve([
    { book: { id: 'b1', title: '1984', author: 'George Orwell', cover_url: null } },
  ])),
}));

import SessionScreen from '../../app/session/index';
import { useSessionStore } from '../../src/stores/sessionStore';
import { startSession } from '../../src/features/session/logic';

const INICIO = new Date('2026-09-20T22:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useSessionStore.setState({ showTimer: true, keepAwake: false });
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

  /**
   * BER-124: o sino toca UMA vez quando o instante gravado chega.
   *
   * O risco aqui e o tique: ele roda a cada segundo, e sem uma trava o fim
   * tocaria de novo a cada segundo depois de acabar. Nao e teoria — e o que
   * acontece quando a condicao e "ja passou do fim" em vez de "acabou de
   * passar".
   */
  it('toca o som de fim uma vez so, e nao a cada tique', () => {
    jest.setSystemTime(new Date('2026-09-20T22:19:58.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'timed', minutes: 20 },
      hydrated: true,
    });

    render(<SessionScreen />);
    expect(mockTocarFim).not.toHaveBeenCalled();

    // O tempo acaba.
    act(() => {
      jest.setSystemTime(new Date('2026-09-20T22:20:01.000Z'));
      jest.advanceTimersByTime(1000);
    });
    expect(mockTocarFim).toHaveBeenCalledTimes(1);

    // E cinco segundos depois continua sendo uma vez.
    act(() => {
      jest.setSystemTime(new Date('2026-09-20T22:20:06.000Z'));
      jest.advanceTimersByTime(5000);
    });
    expect(mockTocarFim).toHaveBeenCalledTimes(1);
  });

  it('mantem a tela acesa so quando o leitor pediu', () => {
    jest.setSystemTime(new Date('2026-09-20T22:05:00.000Z'));
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO });

    useSessionStore.setState({ active: sessao, lastMode: { kind: 'timed', minutes: 20 }, keepAwake: false, hydrated: true });
    const desligada = render(<SessionScreen />);
    expect(mockAtivarTela).not.toHaveBeenCalled();
    desligada.unmount();

    useSessionStore.setState({ active: sessao, lastMode: { kind: 'timed', minutes: 20 }, keepAwake: true, hydrated: true });
    render(<SessionScreen />);
    expect(mockAtivarTela).toHaveBeenCalled();
  });

  /**
   * BER-123: "pausar e retomar funcionam, e o tempo pausado nao conta como
   * leitura". Pausado 2 minutos, o relogio nao anda; retomado, o fim foi
   * empurrado os mesmos 2 minutos e o sino e rearmado para o novo instante.
   */
  it('pausar congela o tempo, desarma o sino, e retomar empurra o fim', async () => {
    jest.setSystemTime(new Date('2026-09-20T22:05:00.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'timed', minutes: 20 },
      hydrated: true,
    });

    const tela = render(<SessionScreen />);
    await act(async () => { fireEvent.press(tela.getByLabelText('Pausar')); });
    expect(mockDesarmar).toHaveBeenCalled();

    // O advanceTimersByTime anda o relogio falso junto: 22:06:59 + 1 s = 22:07.
    act(() => {
      jest.setSystemTime(new Date('2026-09-20T22:06:59.000Z'));
      jest.advanceTimersByTime(1000);
    });
    expect(tela.getByText('15:00')).toBeTruthy();
    expect(tela.getByText('Pausado')).toBeTruthy();

    await act(async () => { fireEvent.press(tela.getByLabelText('Retomar')); });

    expect(useSessionStore.getState().active?.endsAt).toBe('2026-09-20T22:22:00.000Z');
    expect(mockArmar).toHaveBeenCalledWith(expect.objectContaining({ endsAt: '2026-09-20T22:22:00.000Z' }));
  });

  it('na tela calma o numero some, e um toque mostra o tempo', () => {
    jest.setSystemTime(new Date('2026-09-20T22:05:00.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'timed', minutes: 20 },
      showTimer: false,
      hydrated: true,
    });

    const tela = render(<SessionScreen />);
    expect(tela.queryByText('15:00')).toBeNull();

    fireEvent.press(tela.getByLabelText('Mostrar o tempo'));
    expect(tela.getByText('15:00')).toBeTruthy();
  });

  /**
   * Spec §3.3 e S3: o fim da sessao e "ate que pagina voce foi?". Encerrar
   * leva direto ao registro com o livro da sessao, e a sessao some.
   */
  it('encerrar toca o som, limpa a sessao e abre o registro do livro', async () => {
    jest.setSystemTime(new Date('2026-09-20T22:05:00.000Z'));
    useSessionStore.setState({
      active: startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'b1', now: INICIO }),
      lastMode: { kind: 'timed', minutes: 20 },
      hydrated: true,
    });

    const tela = render(<SessionScreen />);
    fireEvent.press(tela.getByText('Encerrar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/register-reading', params: { bookId: 'b1' } });
    });
    expect(mockTocarParada).toHaveBeenCalled();
    expect(useSessionStore.getState().active).toBeNull();
  });
});
