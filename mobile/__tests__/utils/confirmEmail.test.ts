import {
  classifyRefreshResult,
  classifySignInError,
  shouldClearPendingPassword,
  type RefreshResult,
} from '../../src/utils/confirmEmail';

describe('classifyRefreshResult', () => {
  it('confirmed: sessão válida com email_confirmed_at', () => {
    const r: RefreshResult = {
      error: null,
      data: { session: { user: { email_confirmed_at: '2026-04-04T10:00:00Z' } } },
    };
    expect(classifyRefreshResult(r)).toBe('confirmed');
  });

  it('session_revoked: erro de token (confirmou pelo browser)', () => {
    expect(classifyRefreshResult({
      error: { message: 'Invalid Refresh Token' },
      data: { session: null },
    })).toBe('session_revoked');
  });

  it('session_revoked: sem sessão nenhuma', () => {
    expect(classifyRefreshResult({ error: null, data: { session: null } })).toBe('session_revoked');
  });

  it('not_confirmed: sessão existe mas o e-mail ainda não foi confirmado', () => {
    expect(classifyRefreshResult({
      error: null,
      data: { session: { user: { email_confirmed_at: null } } },
    })).toBe('not_confirmed');
  });
});

describe('classifySignInError', () => {
  it('signed-in quando não há erro', () => {
    expect(classifySignInError(null)).toBe('signed-in');
    expect(classifySignInError(undefined)).toBe('signed-in');
  });

  it('not-confirmed reconhece a mensagem do Supabase em qualquer caixa', () => {
    expect(classifySignInError({ message: 'Email not confirmed' })).toBe('not-confirmed');
    expect(classifySignInError({ message: 'EMAIL NOT CONFIRMED' })).toBe('not-confirmed');
  });

  it('error para qualquer outra falha', () => {
    expect(classifySignInError({ message: 'Invalid login credentials' })).toBe('error');
    expect(classifySignInError({ message: 'Network request failed' })).toBe('error');
  });
});

// BER-43: o coração do bug. A senha era apagada ANTES de saber se o login deu
// certo; no segundo toque o app caía no branch sem senha e mandava o usuário
// para o login, obrigando a redigitar tudo.
describe('shouldClearPendingPassword', () => {
  it('só limpa depois de entrar', () => {
    expect(shouldClearPendingPassword('signed-in')).toBe(true);
  });

  it('mantém a senha quando o e-mail ainda não foi confirmado', () => {
    expect(shouldClearPendingPassword('not-confirmed')).toBe(false);
  });

  it('mantém a senha em erro de rede ou credencial', () => {
    expect(shouldClearPendingPassword('error')).toBe(false);
  });
});
