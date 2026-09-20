import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const react = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      react.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});

const mockClear = jest.fn();
const mockAuth = {
  profile: { user_id: 'u1', display_name: 'Guilherme', classroom_id: null, created_at: '2026-01-01' },
  profileStatus: 'ready',
  clear: mockClear,
  session: { user: { id: 'u1' } },
  setProfile: jest.fn(),
};
jest.mock('../../src/stores/authStore', () => ({ useAuthStore: () => mockAuth }));

const mockEntitlement = {
  plan: 'free',
  limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
  usage: { active_books: 1, quiz_chapters_this_month: 3 },
};
jest.mock('../../src/stores/entitlementStore', () => ({
  useEntitlementStore: Object.assign(
    (sel: (s: any) => any) => sel({ entitlement: mockEntitlement }),
    { getState: () => ({ refresh: jest.fn() }) },
  ),
}));

const mockProgress = {
  sessions: [
    { id: 's1', user_id: 'u1', book_id: 'b1', start_page: 1, end_page: 80, pages_read: 80, read_at: '2026-09-01T15:00:00.000Z' },
    { id: 's2', user_id: 'u1', book_id: 'b1', start_page: 81, end_page: 120, pages_read: 40, read_at: '2026-09-02T15:00:00.000Z' },
  ],
  answers: [
    { comprehension_score: 80, evaluation_status: 'completed', question: { chapter_id: 'c1' } },
    { comprehension_score: 70, evaluation_status: 'completed', question: { chapter_id: 'c1' } },
  ],
  badges: [{ id: 'sb1', user_id: 'u1', badge_id: 'bd1', earned_at: '2026-09-01T12:00:00.000Z' }],
  streak: null,
  xp: 300,
  level: require('../../src/game/xp').levelFor(300),
  refresh: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../src/stores/progressStore', () => ({ useProgressStore: () => mockProgress }));

jest.mock('../../src/api/queries', () => ({
  getAllBadges: jest.fn(),
  getStudentBooks: jest.fn(),
  joinClassroom: jest.fn(),
}));
jest.mock('../../src/api/edgeFunctions', () => ({ deleteAccount: jest.fn() }));
jest.mock('../../src/lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));

import PerfilScreen from '../../app/(tabs)/perfil';
import { ToastProvider } from '../../src/ui/Toast';
import { getAllBadges, getStudentBooks } from '../../src/api/queries';
import { deleteAccount } from '../../src/api/edgeFunctions';
import { supabase } from '../../src/lib/supabase';

async function montar() {
  const tela = render(
    <ToastProvider>
      <PerfilScreen />
    </ToastProvider>,
  );
  await act(async () => {});
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAllBadges as jest.Mock).mockResolvedValue([
    { id: 'bd1', name: 'Primeira Página', description: 'Registre sua primeira leitura.', icon_url: null, criteria_type: 'total_sessions', criteria_value: 1 },
    { id: 'bd2', name: 'Devorador de Páginas', description: 'Leia 500 páginas.', icon_url: null, criteria_type: 'total_pages', criteria_value: 500 },
  ]);
  (getStudentBooks as jest.Mock).mockResolvedValue([{ status: 'finished' }, { status: 'reading' }]);
  (deleteAccount as jest.Mock).mockResolvedValue(undefined);
});

describe('Você (spec 7.9)', () => {
  it('cabecalho com nivel e os tres numeros', async () => {
    const tela = await montar();
    expect(tela.getByText('Guilherme')).toBeTruthy();
    expect(tela.getByText('Nível 2 · Curioso')).toBeTruthy();
    expect(tela.getByLabelText('120 páginas')).toBeTruthy();
    expect(tela.getByLabelText('75 média geral')).toBeTruthy();
    expect(tela.getByLabelText('0 dias seguidos')).toBeTruthy();
  });

  it('conquistas com progresso, e o toque abre o detalhe', async () => {
    const tela = await montar();
    expect(tela.getByText('1 de 2')).toBeTruthy();
    expect(tela.getByText('120 de 500')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: /Devorador de Páginas/ }));
    expect(tela.getByText('Leia 500 páginas.')).toBeTruthy();
  });

  it('uso do plano em texto, e a linha leva aos planos', async () => {
    const tela = await montar();
    fireEvent.press(tela.getByRole('button', { name: /Plano gratuito/ }));
    expect(mockPush).toHaveBeenCalledWith('/planos');
  });

  it('Sair pede confirmacao antes de sair', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = await montar();
    fireEvent.press(tela.getByRole('button', { name: 'Sair' }));
    expect(alerta.mock.calls[0][0]).toBe('Sair da conta?');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    await act(async () => { await (alerta.mock.calls[0][2] as any)[1].onPress(); });
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });

  it('Excluir conta confirma e chama a funcao do servidor', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = await montar();
    fireEvent.press(tela.getByRole('button', { name: 'Excluir conta' }));
    expect(alerta.mock.calls[0][0]).toBe('Excluir sua conta?');
    await act(async () => { await (alerta.mock.calls[0][2] as any)[1].onPress(); });
    expect(deleteAccount).toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });

  // BER-64: a entrada de turma saiu do perfil. O produto e B2C desde a BER-52
  // e nao tem turma; esta era a unica porta no app inteiro para um fluxo que
  // tambem nunca funcionou (BER-32, cancelada). O teste antigo afirmava que a
  // linha existia — virou o contrario, para a superficie escolar nao voltar
  // sem alguem decidir. O componente e o backend continuam de pe para a fase
  // 2 (BER-47).
  it('nao oferece entrar em uma turma: o produto B2C nao tem turma', async () => {
    const tela = await montar();
    expect(tela.queryByRole('button', { name: 'Entrar em uma turma' })).toBeNull();
    expect(tela.queryByText('Com o código do seu professor')).toBeNull();
  });
});
