// Testa a lógica de confirmação de email (extraída do componente para teste)

// Replica a lógica de confirm-email.tsx:handleAlreadyConfirmed
type RefreshResult =
  | { error: { message: string }; data: { session: null } }
  | { error: null; data: { session: null } }
  | { error: null; data: { session: { user: { email_confirmed_at: string | null } } } };

type Outcome = 'confirmed' | 'session_revoked' | 'not_confirmed';

function classifyRefreshResult(result: RefreshResult): Outcome {
  const { data, error } = result;

  if (!error && data?.session?.user.email_confirmed_at) {
    return 'confirmed';
  }

  if (error || !data?.session) {
    return 'session_revoked';
  }

  return 'not_confirmed';
}

describe('classifyRefreshResult', () => {
  describe('confirmed', () => {
    it('retorna "confirmed" quando sessão é válida e email_confirmed_at está definido', () => {
      expect(classifyRefreshResult({
        error: null,
        data: { session: { user: { email_confirmed_at: '2026-04-04T10:00:00Z' } } },
      })).toBe('confirmed');
    });
  });

  describe('session_revoked', () => {
    it('retorna "session_revoked" quando há erro (token inválido após confirmação pelo browser)', () => {
      expect(classifyRefreshResult({
        error: { message: 'Invalid Refresh Token' },
        data: { session: null },
      })).toBe('session_revoked');
    });

    it('retorna "session_revoked" quando não há sessão (sem token armazenado)', () => {
      expect(classifyRefreshResult({
        error: null,
        data: { session: null },
      })).toBe('session_revoked');
    });
  });

  describe('not_confirmed', () => {
    it('retorna "not_confirmed" quando sessão é válida mas email_confirmed_at é null', () => {
      expect(classifyRefreshResult({
        error: null,
        data: { session: { user: { email_confirmed_at: null } } },
      })).toBe('not_confirmed');
    });
  });
});
