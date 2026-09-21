import {
  canSignup, isEmailAlreadyRegistered, isPasswordStrong, loginErrorMessage, passwordHint,
  resendLabel, signupErrorMessage,
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

describe('isPasswordStrong (BER-81)', () => {
  it('exige 8 caracteres, com letra e número', () => {
    expect(isPasswordStrong('senha123')).toBe(true);
    expect(isPasswordStrong('senha12')).toBe(false); // 7 caracteres
    expect(isPasswordStrong('senhasenha')).toBe(false); // sem número
    expect(isPasswordStrong('12345678')).toBe(false); // sem letra
  });

  // A regra tem que ser a mesma do painel do Supabase, que só conta letra
  // ASCII: aceitar acento aqui liberaria senha que o servidor recusa.
  it('acento não conta como letra', () => {
    expect(isPasswordStrong('ãéíõçá12')).toBe(false);
    expect(isPasswordStrong('ãéíõçá1a')).toBe(true);
  });
});

describe('canSignup', () => {
  it('nome de 2, e-mail com @ e senha forte', () => {
    expect(canSignup('Ana', 'a@b.com', 'senha123')).toBe(true);
    expect(canSignup('A', 'a@b.com', 'senha123')).toBe(false);
    expect(canSignup('Ana', 'ab.com', 'senha123')).toBe(false);
    expect(canSignup('Ana', 'a@b.com', 'senha12')).toBe(false);
    expect(canSignup('Ana', 'a@b.com', 'senhasenha')).toBe(false);
  });
});

describe('passwordHint', () => {
  it('com o campo vazio, diz a regra inteira antes de o leitor errar', () => {
    expect(passwordHint('')).toBe('Mínimo de 8 caracteres, com letras e números.');
  });

  it('diz quanto falta em caracteres', () => {
    expect(passwordHint('abc')).toBe('Faltam 5 caracteres.');
    expect(passwordHint('abcdefg')).toBe('Falta 1 caractere.');
  });

  it('no tamanho certo, aponta o que falta na composição', () => {
    expect(passwordHint('senhasenha')).toBe('Falta um número.');
    expect(passwordHint('12345678')).toBe('Falta uma letra.');
    expect(passwordHint('senha123')).toBe('Senha no ponto.');
  });
});

describe('signupErrorMessage (BER-81)', () => {
  it('senha fraca vira instrução, não mensagem genérica', () => {
    const esperado = 'Senha fraca: use 8 caracteres ou mais, com letras e números.';
    expect(signupErrorMessage({ code: 'weak_password' })).toBe(esperado);
    // SDK antigo não manda código, só a mensagem em inglês.
    expect(signupErrorMessage({ message: 'Password should be at least 8 characters.' })).toBe(esperado);
  });

  it('o resto continua genérico, e em português', () => {
    const generico = 'Não deu pra criar sua conta agora. Tenta de novo.';
    expect(signupErrorMessage({ message: 'fetch failed' })).toBe(generico);
    expect(signupErrorMessage(null)).toBe(generico);
    expect(signupErrorMessage(undefined)).toBe(generico);
  });
});

describe('resendLabel', () => {
  it('contador enquanto espera, acao quando libera', () => {
    expect(resendLabel(42)).toBe('Reenviar em 42s');
    expect(resendLabel(0)).toBe('Reenviar e-mail');
  });
});
