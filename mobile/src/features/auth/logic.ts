// Logica pura da entrada (spec 7.10, F6 Tarefa 4). Sem React: so texto e regra.

export const MIN_PASSWORD = 8;
export const RESEND_COOLDOWN_S = 60;

// BER-81: a composição é ASCII de propósito. É a mesma regra que vai ser ligada
// no painel do Supabase (`Password requirements` = letras e dígitos), que não
// considera `á` uma letra. Aceitar acento aqui liberaria no app senha que o
// servidor recusa — justamente o descompasso que esta issue existe para evitar.
const temLetra = (password: string) => /[a-zA-Z]/.test(password);
const temNumero = (password: string) => /[0-9]/.test(password);

/** Mínimo de `MIN_PASSWORD` caracteres, com pelo menos uma letra e um número. */
export function isPasswordStrong(password: string): boolean {
  return password.length >= MIN_PASSWORD && temLetra(password) && temNumero(password);
}

/** Mensagem do Supabase no login, traduzida pro que o leitor precisa saber. */
export function loginErrorMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha não conferem.';
  if (m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada.';
  return 'Não deu pra entrar agora. Tenta de novo.';
}

/**
 * O Supabase nao devolve erro para e-mail ja cadastrado: devolve o usuario com
 * `identities` vazio. Mesma regra de __tests__/screens/signup.logic.test.ts.
 */
export function isEmailAlreadyRegistered(
  data: { user: { identities?: unknown[] | null } | null } | null,
): boolean {
  const identities = data?.user?.identities;
  return Array.isArray(identities) && identities.length === 0;
}

/** Regra do botao "Criar conta": nome, e-mail com @ e senha forte (BER-81). */
export function canSignup(name: string, email: string, password: string): boolean {
  return name.trim().length >= 2 && email.includes('@') && isPasswordStrong(password);
}

/**
 * Quanto falta pra senha valer. Com o campo vazio diz a regra inteira, para o
 * leitor saber antes de errar, e não só depois (BER-81).
 */
export function passwordHint(password: string): string {
  if (password.length === 0) return `Mínimo de ${MIN_PASSWORD} caracteres, com letras e números.`;
  const faltam = MIN_PASSWORD - password.length;
  if (faltam > 0) return faltam === 1 ? 'Falta 1 caractere.' : `Faltam ${faltam} caracteres.`;
  if (!temLetra(password)) return 'Falta uma letra.';
  if (!temNumero(password)) return 'Falta um número.';
  return 'Senha no ponto.';
}

/**
 * Erro do cadastro, em português. O caso que importa é a senha fraca: com a
 * mensagem genérica, quem esbarrasse na regra do servidor tentaria a mesma
 * senha de novo sem nunca saber o que havia de errado.
 *
 * O Supabase devolve `code: 'weak_password'`; a checagem por mensagem cobre a
 * versão do SDK que ainda não mandava código.
 */
export function signupErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
): string {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();
  if (code === 'weak_password' || message.includes('password should be') || message.includes('weak password')) {
    return `Senha fraca: use ${MIN_PASSWORD} caracteres ou mais, com letras e números.`;
  }
  return 'Não deu pra criar sua conta agora. Tenta de novo.';
}

export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Reenviar em ${secondsLeft}s` : 'Reenviar e-mail';
}
