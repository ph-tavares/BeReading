import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismiss = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, dismiss: mockDismiss }),
}));

const mockStore: any = { entitlement: null, refresh: jest.fn(), setEntitlement: jest.fn() };
jest.mock('../../src/stores/entitlementStore', () => ({ useEntitlementStore: () => mockStore }));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: () => ({ session: { user: { email: 'ana@exemplo.com' } } }),
}));

jest.mock('../../src/api/billing', () => ({
  billing: { purchase: jest.fn(), cancel: jest.fn(), resume: jest.fn() },
}));

import PlanosScreen from '../../app/planos';
import CheckoutScreen from '../../app/checkout';
import { ToastProvider } from '../../src/ui/Toast';
import { billing } from '../../src/api/billing';
import { formatPrice } from '../../src/utils/billing';

const b = billing as unknown as Record<string, jest.Mock>;

const BASE = {
  premium_plan: { id: 'premium_monthly', name: 'Premium', price_cents: 1990 },
  free_limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
  limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
  usage: { active_books: 1, quiz_chapters_this_month: 3 },
  usage_resets_at: '2026-10-01T00:00:00.000Z',
};
const GRATUITO = { ...BASE, plan: 'free', subscription: null };
const assinatura = (cancel: boolean) => ({
  ...BASE,
  plan: 'premium',
  limits: { max_active_books: null, monthly_quiz_chapters: null },
  subscription: { current_period_end: '2026-10-15T12:00:00.000Z', cancel_at_period_end: cancel },
});
const PRECO = formatPrice(1990);

function montar(tela: React.ReactElement) {
  return render(<ToastProvider>{tela}</ToastProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.entitlement = GRATUITO;
  mockStore.refresh.mockResolvedValue(undefined);
});

describe('Planos (BER-61, F6)', () => {
  it('gratuito: compara os planos e leva ao checkout', async () => {
    const tela = montar(<PlanosScreen />);
    await act(async () => {});
    expect(tela.getByText('Leia sem limites')).toBeTruthy();
    expect(tela.getByText('Seu plano')).toBeTruthy();
    expect(tela.getByText('Até 2 livros em leitura ao mesmo tempo')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: `Assinar por ${PRECO}/mês` }));
    expect(mockPush).toHaveBeenCalledWith('/checkout');
  });

  it('premium ativo: cancelar confirma com "Manter Premium" antes de cancelar', async () => {
    mockStore.entitlement = assinatura(false);
    b.cancel.mockResolvedValue(assinatura(true));
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tela = montar(<PlanosScreen />);
    await act(async () => {});
    fireEvent.press(tela.getByRole('button', { name: 'Cancelar assinatura' }));
    expect(alerta.mock.calls[0][0]).toBe('Cancelar assinatura?');
    const botoes = alerta.mock.calls[0][2] as any[];
    expect(botoes[0].text).toBe('Manter Premium');
    expect(b.cancel).not.toHaveBeenCalled();
    await act(async () => { botoes[1].onPress(); });
    expect(b.cancel).toHaveBeenCalled();
    expect(mockStore.setEntitlement).toHaveBeenCalledWith(assinatura(true));
  });

  it('premium cancelado: retomar chama o billing', async () => {
    mockStore.entitlement = assinatura(true);
    b.resume.mockResolvedValue(assinatura(false));
    const tela = montar(<PlanosScreen />);
    await act(async () => {});
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Retomar assinatura' })); });
    expect(b.resume).toHaveBeenCalled();
  });

  it('sem plano carregado: diz o que houve e tenta de novo', async () => {
    mockStore.entitlement = null;
    const tela = montar(<PlanosScreen />);
    await act(async () => {});
    expect(tela.getByText('Não deu pra carregar os planos.')).toBeTruthy();
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: 'Tentar de novo' })); });
    expect(mockStore.refresh).toHaveBeenCalledTimes(2);
  });
});

describe('Checkout (BER-61, F6)', () => {
  it('resume a compra, assina e mostra a confirmacao', async () => {
    b.purchase.mockResolvedValue(assinatura(false));
    const tela = montar(<CheckoutScreen />);
    expect(tela.getByText('ana@exemplo.com')).toBeTruthy();
    expect(tela.getByText(`${PRECO}/mês`)).toBeTruthy();
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: `Assinar por ${PRECO}/mês` })); });
    await waitFor(() => expect(tela.getByText('Bem-vindo ao Premium.')).toBeTruthy(), { timeout: 3000 });
    expect(b.purchase).toHaveBeenCalledWith('premium_monthly');
    expect(mockStore.setEntitlement).toHaveBeenCalledWith(assinatura(false));
    fireEvent.press(tela.getByRole('button', { name: 'Continuar' }));
    expect(mockDismiss).toHaveBeenCalledWith(2);
  });

  it('falha na compra vira toast e volta pra confirmacao', async () => {
    b.purchase.mockRejectedValue(new Error('rede'));
    const tela = montar(<CheckoutScreen />);
    await act(async () => { fireEvent.press(tela.getByRole('button', { name: `Assinar por ${PRECO}/mês` })); });
    await waitFor(() => expect(tela.getByText('Não deu pra concluir a assinatura.')).toBeTruthy(), { timeout: 3000 });
    expect(tela.getByRole('button', { name: `Assinar por ${PRECO}/mês` })).toBeTruthy();
  });
});
