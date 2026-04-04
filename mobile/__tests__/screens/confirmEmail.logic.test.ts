// Testa a lógica de confirmação de email (extraída do componente para teste)

// Replica a lógica de confirm-email.tsx:handleAlreadyConfirmed
function isEmailConfirmedAfterRefresh(
  data: { session: { user: { email_confirmed_at: string | null } } | null } | null,
  error: { message: string } | null,
): boolean {
  return !error && !!data?.session?.user.email_confirmed_at;
}

describe('isEmailConfirmedAfterRefresh', () => {
  it('retorna false quando há erro', () => {
    expect(isEmailConfirmedAfterRefresh(null, { message: 'Session expired' })).toBe(false);
  });

  it('retorna false quando session é null (sem sessão ativa)', () => {
    expect(isEmailConfirmedAfterRefresh({ session: null }, null)).toBe(false);
  });

  it('retorna false quando email_confirmed_at é null (email não confirmado)', () => {
    expect(isEmailConfirmedAfterRefresh(
      { session: { user: { email_confirmed_at: null } } },
      null,
    )).toBe(false);
  });

  it('retorna true quando email_confirmed_at está definido', () => {
    expect(isEmailConfirmedAfterRefresh(
      { session: { user: { email_confirmed_at: '2026-04-04T10:00:00Z' } } },
      null,
    )).toBe(true);
  });
});
