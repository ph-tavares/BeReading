import { render, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import { PaywallSheet } from '../../../src/features/plans/PaywallSheet';
import { PaywallSheet as PaywallDoCaminhoLegado } from '../../../src/components/PaywallSheet';
import type { QuotaExceeded } from '../../../src/utils/billing';

const LIVROS: QuotaExceeded = { reason: 'active_books', limit: 2, used: 2, resets_at: null };

beforeEach(() => mockPush.mockReset());

describe('PaywallSheet (BER-58, sistema novo)', () => {
  it('com limite: titulo e descricao de paywallCopy', () => {
    const { getByText } = render(<PaywallSheet quota={LIVROS} onDismiss={jest.fn()} />);
    expect(getByText('Você já está lendo 2 livros')).toBeTruthy();
    expect(getByText(/Com o Premium, você lê quantos quiser/)).toBeTruthy();
  });

  it('"Conhecer o Premium" fecha e leva aos planos', () => {
    const onDismiss = jest.fn();
    const { getByRole } = render(<PaywallSheet quota={LIVROS} onDismiss={onDismiss} />);
    fireEvent.press(getByRole('button', { name: 'Conhecer o Premium' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/planos');
  });

  it('"Agora não" so fecha', () => {
    const onDismiss = jest.fn();
    const { getByRole } = render(<PaywallSheet quota={LIVROS} onDismiss={onDismiss} />);
    fireEvent.press(getByRole('button', { name: 'Agora não' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sem limite (quota null): nada na tela', () => {
    const { queryByText } = render(<PaywallSheet quota={null} onDismiss={jest.fn()} />);
    expect(queryByText('Conhecer o Premium')).toBeNull();
  });

  it('o caminho legado (src/components) e o mesmo componente: as telas do time nao mudam', () => {
    expect(PaywallDoCaminhoLegado).toBe(PaywallSheet);
  });
});
