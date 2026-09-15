import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ email: 'ana@exemplo.com' }),
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      refreshSession: jest.fn(),
      resend: jest.fn(),
    },
  },
}));

const mockSetPending = jest.fn();
const mockClearPending = jest.fn();
let mockPendingPassword: string | null = null;
jest.mock('../../src/stores/pendingAuthStore', () => ({
  usePendingAuthStore: (sel?: (s: any) => any) => {
    const estado = {
      pendingPassword: mockPendingPassword,
      setPendingPassword: mockSetPending,
      clearPendingPassword: mockClearPending,
    };
    return sel ? sel(estado) : estado;
  },
}));

jest.mock('../../src/utils/confirmEmail', () => ({
  classifyRefreshResult: jest.fn(),
  classifySignInError: jest.fn(),
  shouldClearPendingPassword: jest.fn(),
}));

import LoginScreen from '../../app/(auth)/login';
import SignupScreen from '../../app/(auth)/signup';
import ConfirmEmailScreen from '../../app/(auth)/confirm-email';
import { ToastProvider } from '../../src/ui/Toast';
import { supabase } from '../../src/lib/supabase';
import {
  classifyRefreshResult, classifySignInError, shouldClearPendingPassword,
} from '../../src/utils/confirmEmail';

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockPendingPassword = null;
});

describe('Login (spec 7.10)', () => {
  it('marca e frase no topo; so entra com e-mail e senha', async () => {
    const tela = render(<LoginScreen />);
    expect(tela.getByLabelText('BeReading')).toBeTruthy();
    expect(tela.getByText('Você lê. A gente te faz pensar sobre o que leu.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Entrar' }));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('credencial errada vira erro no campo, sem Alert', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const tela = render(<LoginScreen />);
    fireEvent.changeText(tela.getByLabelText('E-mail'), ' ana@exemplo.com ');
    fireEvent.changeText(tela.getByLabelText('Senha'), 'errada');
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Entrar' })); });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'errada' });
    expect(tela.getByText('E-mail ou senha não conferem.')).toBeTruthy();
  });

  it('Criar conta leva ao cadastro', () => {
    const tela = render(<LoginScreen />);
    fireEvent.press(tela.getByRole('button', { name: 'Criar conta' }));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/signup');
  });
});

describe('Criar conta (spec 7.10)', () => {
  function preencher(tela: ReturnType<typeof render>, senha = '123456') {
    fireEvent.changeText(tela.getByLabelText('Nome'), 'Ana');
    fireEvent.changeText(tela.getByLabelText('E-mail'), 'ana@exemplo.com');
    fireEvent.changeText(tela.getByLabelText('Senha'), senha);
  }

  it('diz quanto falta pra senha e segura o botao ate valer', () => {
    const tela = render(<SignupScreen />);
    preencher(tela, 'abc');
    expect(tela.getByText('Faltam 3 caracteres.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Criar conta' }));
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('cadastro novo guarda a senha e vai confirmar o e-mail', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null });
    const tela = render(<SignupScreen />);
    preencher(tela);
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Criar conta' })); });
    expect(mockSetPending).toHaveBeenCalledWith('123456');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/confirm-email', params: { email: 'ana@exemplo.com' } });
  });

  it('e-mail ja cadastrado aparece no campo e oferece o login', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
    const tela = render(<SignupScreen />);
    preencher(tela);
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Criar conta' })); });
    expect(tela.getByText('Esse e-mail já tem conta. Entre com ele.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Ir pro login' }));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});

describe('Confirmar e-mail (spec 7.10, BER-43)', () => {
  function montar() {
    return render(
      <ToastProvider>
        <ConfirmEmailScreen />
      </ToastProvider>,
    );
  }

  it('com senha guardada e e-mail nao confirmado: aviso inline e a senha fica', async () => {
    mockPendingPassword = '123456';
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed' } });
    (classifySignInError as jest.Mock).mockReturnValue('not-confirmed');
    (shouldClearPendingPassword as jest.Mock).mockReturnValue(false);
    const tela = montar();
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Já confirmei' })); });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: '123456' });
    expect(tela.getByText('Seu e-mail ainda não foi confirmado. Abra o link e tente de novo.')).toBeTruthy();
    expect(mockClearPending).not.toHaveBeenCalled();
  });

  it('entrou: descarta a senha guardada so depois de entrar', async () => {
    mockPendingPassword = '123456';
    auth.signInWithPassword.mockResolvedValue({ error: null });
    (classifySignInError as jest.Mock).mockReturnValue('signed-in');
    (shouldClearPendingPassword as jest.Mock).mockReturnValue(true);
    const tela = montar();
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Já confirmei' })); });
    expect(mockClearPending).toHaveBeenCalled();
  });

  it('sessao revogada explica e leva ao login', async () => {
    auth.refreshSession.mockResolvedValue({});
    (classifyRefreshResult as jest.Mock).mockReturnValue('session_revoked');
    const tela = montar();
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Já confirmei' })); });
    expect(tela.getByText(/confirmado em outro lugar/)).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Ir para o login' }));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('reenviar espera 60 s, depois reenvia com toast e reinicia o contador', async () => {
    jest.useFakeTimers();
    try {
      auth.resend.mockResolvedValue({ error: null });
      const tela = montar();
      expect(tela.getByText('Reenviar em 60s')).toBeTruthy();
      fireEvent.press(tela.getByRole('button', { name: 'Reenviar em 60s' }));
      expect(auth.resend).not.toHaveBeenCalled();

      for (let i = 0; i < 60; i++) {
        act(() => { jest.advanceTimersByTime(1000); });
      }
      expect(tela.getByText('Reenviar e-mail')).toBeTruthy();

      await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Reenviar e-mail' })); });
      expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@exemplo.com' });
      expect(tela.getByText('E-mail reenviado.')).toBeTruthy();
      expect(tela.getByText('Reenviar em 60s')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
