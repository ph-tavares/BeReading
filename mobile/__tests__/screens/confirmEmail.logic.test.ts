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

// ── classifySignInResult ──────────────────────────────────────────────────────
// Replica a lógica de confirm-email.tsx para classificar resultado de signInWithPassword

type SignInOutcome = 'auto_login_success' | 'email_not_confirmed' | 'login_error';

function classifySignInResult(error: { message: string } | null): SignInOutcome {
  if (!error) return 'auto_login_success';
  if (error.message.toLowerCase().includes('email not confirmed')) return 'email_not_confirmed';
  return 'login_error';
}

describe('classifySignInResult', () => {
  it('retorna auto_login_success quando não há erro', () => {
    expect(classifySignInResult(null)).toBe('auto_login_success');
  });

  it('retorna email_not_confirmed para erro "Email not confirmed"', () => {
    expect(classifySignInResult({ message: 'Email not confirmed' })).toBe('email_not_confirmed');
  });

  it('email not confirmed é case-insensitive', () => {
    expect(classifySignInResult({ message: 'email not confirmed' })).toBe('email_not_confirmed');
  });

  it('retorna login_error para credenciais inválidas', () => {
    expect(classifySignInResult({ message: 'Invalid login credentials' })).toBe('login_error');
  });

  it('retorna login_error para rate limit', () => {
    expect(classifySignInResult({ message: 'Email rate limit exceeded' })).toBe('login_error');
  });
});
