import { usePendingAuthStore } from '../../src/stores/pendingAuthStore';

beforeEach(() => {
  usePendingAuthStore.setState({ pendingPassword: null });
});

describe('usePendingAuthStore', () => {
  it('estado inicial é null', () => {
    expect(usePendingAuthStore.getState().pendingPassword).toBeNull();
  });

  it('setPendingPassword armazena a senha', () => {
    usePendingAuthStore.getState().setPendingPassword('minhasenha123');
    expect(usePendingAuthStore.getState().pendingPassword).toBe('minhasenha123');
  });

  it('clearPendingPassword limpa para null', () => {
    usePendingAuthStore.getState().setPendingPassword('senha');
    usePendingAuthStore.getState().clearPendingPassword();
    expect(usePendingAuthStore.getState().pendingPassword).toBeNull();
  });
});
