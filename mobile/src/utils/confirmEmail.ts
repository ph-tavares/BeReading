// src/utils/confirmEmail.ts
// Decisões da tela de confirmação de e-mail, fora do componente para terem teste
// de verdade. Antes, `__tests__/screens/confirmEmail.logic.test.ts` declarava uma
// *réplica* de `classifyRefreshResult` e testava a réplica — mesmo problema que a
// BER-35 apontou no backend: mudar a tela não quebrava teste nenhum.

export type RefreshOutcome = 'confirmed' | 'session_revoked' | 'not_confirmed';

export interface RefreshResult {
  error: { message: string } | null;
  // `email_confirmed_at` do supabase-js é `string | undefined`. O teste antigo,
  // que era uma cópia da lógica, declarava `string | null` e por isso nunca
  // esbarrou na diferença — os dois lados eram fictícios (BER-35).
  data: { session: { user: { email_confirmed_at?: string | null } } | null } | null;
}

/** O que o `refreshSession` está dizendo sobre a confirmação do e-mail. */
export function classifyRefreshResult(result: RefreshResult): RefreshOutcome {
  const { data, error } = result;
  if (!error && data?.session?.user.email_confirmed_at) return 'confirmed';
  if (error || !data?.session) return 'session_revoked';
  return 'not_confirmed';
}

export type SignInOutcome = 'signed-in' | 'not-confirmed' | 'error';

/**
 * O que o `signInWithPassword` está dizendo.
 *
 * BER-43: a distinção importa porque só o `signed-in` pode limpar a senha
 * guardada. Limpar antes de saber o resultado — que é o que a tela fazia —
 * transformava o segundo toque em "digite tudo de novo".
 */
export function classifySignInError(error: { message: string } | null | undefined): SignInOutcome {
  if (!error) return 'signed-in';
  return error.message.toLowerCase().includes('email not confirmed') ? 'not-confirmed' : 'error';
}

/**
 * A senha guardada pode ser descartada?
 *
 * Só depois de entrar. Enquanto o login não acontece, ela é a única coisa que
 * separa o usuário de refazer o cadastro inteiro — o `pendingAuthStore` vive só
 * em memória, então o que se perde aqui não volta.
 */
export function shouldClearPendingPassword(outcome: SignInOutcome): boolean {
  return outcome === 'signed-in';
}
