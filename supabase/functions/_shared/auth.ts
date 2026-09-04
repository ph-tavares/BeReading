// supabase/functions/_shared/auth.ts
// Autorização das Edge Functions.
//
// Duas naturezas de função, dois guards:
//   - função de usuário (chamada pelo app): o dono da ação é o JWT, nunca o corpo.
//   - função interna (chamada por outra function ou pelo pg_cron): exige a service_role key.
//
// Ver BER-30. O corpo continua podendo trazer `user_id` (o app manda), mas ele é
// tratado como afirmação do cliente: se divergir do JWT, a requisição é recusada.

export interface AuthUser {
  id: string;
}

export type GetUserFn = (
  token: string,
) => Promise<{ data: { user: AuthUser | null }; error: unknown }>;

export class AuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Extrai o token de um header `Authorization: Bearer <token>`. */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve o dono da ação a partir do JWT.
 *
 * @param bodyUserId `user_id` que veio no corpo — aceito por compatibilidade com o app,
 *                   mas nunca confiado: serve só para detectar divergência.
 * @throws AuthError 401 sem token ou com token inválido; 403 se o corpo apontar outro usuário.
 */
export async function resolveUserId(
  authHeader: string | null | undefined,
  bodyUserId: string | null | undefined,
  getUser: GetUserFn,
): Promise<string> {
  const token = extractBearer(authHeader);
  if (!token) {
    throw new AuthError(401, 'Authentication required');
  }

  const { data, error } = await getUser(token);
  if (error || !data?.user?.id) {
    throw new AuthError(401, 'Invalid or expired session');
  }

  const authenticatedId = data.user.id;
  if (bodyUserId && bodyUserId !== authenticatedId) {
    // Tentativa de agir em nome de outro usuário (o IDOR do BER-30).
    throw new AuthError(403, 'Forbidden');
  }

  return authenticatedId;
}

/** Comparação de tempo constante — não vaza o prefixo correto da chave. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * A requisição apresenta a service_role key?
 *
 * Falha fechada — sem a env configurada, a resposta é `false`. Use quando a
 * chamada interna é um *caminho alternativo* e não uma exigência (BER-36: o cron
 * re-avalia respostas na `evaluate-answer`, que para o app segue exigindo JWT).
 */
export function isServiceRole(
  authHeader: string | null | undefined,
  serviceRoleKey: string | null | undefined,
): boolean {
  const token = extractBearer(authHeader);
  if (!token || !serviceRoleKey) return false;
  return safeEqual(token, serviceRoleKey);
}

/**
 * Guard das funções internas: só passa quem apresenta a service_role key.
 * Falha fechada — sem a env configurada, ninguém entra.
 *
 * @throws AuthError 401
 */
export function assertServiceRole(
  authHeader: string | null | undefined,
  serviceRoleKey: string | null | undefined,
): void {
  if (!isServiceRole(authHeader, serviceRoleKey)) {
    throw new AuthError(401, 'Service role required');
  }
}

/** Resposta padrão para um AuthError (ou 500 se o erro não for de auth). */
export function authErrorResponse(err: unknown): Response {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof AuthError ? err.message : 'Internal error';
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
