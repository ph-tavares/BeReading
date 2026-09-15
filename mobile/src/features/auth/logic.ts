// Logica pura da entrada (spec 7.10, F6 Tarefa 4). Sem React: so texto e regra.

export const MIN_PASSWORD = 6;
export const RESEND_COOLDOWN_S = 60;

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

/** Regra do botao "Criar conta", a mesma de antes: nome, e-mail com @ e senha de 6. */
export function canSignup(name: string, email: string, password: string): boolean {
  return name.trim().length >= 2 && email.includes('@') && password.length >= MIN_PASSWORD;
}

/** Quanto falta pra senha valer. */
export function passwordHint(length: number): string {
  if (length === 0) return `Mínimo de ${MIN_PASSWORD} caracteres.`;
  const faltam = MIN_PASSWORD - length;
  if (faltam <= 0) return 'Senha no ponto.';
  return faltam === 1 ? 'Falta 1 caractere.' : `Faltam ${faltam} caracteres.`;
}

export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Reenviar em ${secondsLeft}s` : 'Reenviar e-mail';
}
