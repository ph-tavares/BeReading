import {
  canSignup, isEmailAlreadyRegistered, loginErrorMessage, passwordHint, resendLabel,
} from '../../../src/features/auth/logic';

describe('loginErrorMessage', () => {
  it('traduz o que o leitor precisa saber', () => {
    expect(loginErrorMessage('Invalid login credentials')).toBe('E-mail ou senha não conferem.');
    expect(loginErrorMessage('Email not confirmed')).toMatch(/^Confirme seu e-mail/);
    expect(loginErrorMessage('fetch failed')).toBe('Não deu pra entrar agora. Tenta de novo.');
    expect(loginErrorMessage(undefined)).toBe('Não deu pra entrar agora. Tenta de novo.');
  });
});

describe('isEmailAlreadyRegistered', () => {
  it('identities vazio = e-mail ja cadastrado; o resto nao', () => {
    expect(isEmailAlreadyRegistered({ user: { identities: [] } })).toBe(true);
    expect(isEmailAlreadyRegistered({ user: { identities: [{ id: 'x' }] } })).toBe(false);
    expect(isEmailAlreadyRegistered({ user: { identities: null } })).toBe(false);
    expect(isEmailAlreadyRegistered({ user: null })).toBe(false);
    expect(isEmailAlreadyRegistered(null)).toBe(false);
  });
});

describe('canSignup', () => {
  it('mesma regra de antes: nome de 2, e-mail com @ e senha de 6', () => {
    expect(canSignup('Ana', 'a@b.com', '123456')).toBe(true);
    expect(canSignup('A', 'a@b.com', '123456')).toBe(false);
    expect(canSignup('Ana', 'ab.com', '123456')).toBe(false);
    expect(canSignup('Ana', 'a@b.com', '12345')).toBe(false);
  });
});

describe('passwordHint', () => {
  it('diz quanto falta pra senha de 6', () => {
    expect(passwordHint(0)).toBe('Mínimo de 6 caracteres.');
    expect(passwordHint(3)).toBe('Faltam 3 caracteres.');
    expect(passwordHint(5)).toBe('Falta 1 caractere.');
    expect(passwordHint(6)).toBe('Senha no ponto.');
  });
});

describe('resendLabel', () => {
  it('contador enquanto espera, acao quando libera', () => {
    expect(resendLabel(42)).toBe('Reenviar em 42s');
    expect(resendLabel(0)).toBe('Reenviar e-mail');
  });
});
