// supabase/functions/_shared/auth.test.ts
// Testa o módulo REAL (import de ./auth.ts), não uma cópia da lógica — ver BER-35.
import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  assertServiceRole,
  AuthError,
  extractBearer,
  type GetUserFn,
  isServiceRole,
  resolveUserId,
} from './auth.ts';

const VALID_TOKEN = 'jwt-do-usuario';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

/** getUser falso: reconhece um único token e devolve um único usuário. */
const fakeGetUser: GetUserFn = (token) =>
  Promise.resolve(
    token === VALID_TOKEN
      ? { data: { user: { id: USER_ID } }, error: null }
      : { data: { user: null }, error: new Error('invalid token') },
  );

// --- extractBearer ---

Deno.test('extractBearer: extrai o token de um header Bearer', () => {
  assertEquals(extractBearer('Bearer abc.def.ghi'), 'abc.def.ghi');
});

Deno.test('extractBearer: aceita "bearer" minúsculo', () => {
  assertEquals(extractBearer('bearer abc'), 'abc');
});

Deno.test('extractBearer: devolve null para header ausente ou malformado', () => {
  assertEquals(extractBearer(null), null);
  assertEquals(extractBearer(''), null);
  assertEquals(extractBearer('abc.def.ghi'), null);
  assertEquals(extractBearer('Bearer '), null);
});

// --- resolveUserId (BER-30) ---

Deno.test('resolveUserId: deriva o user do JWT e IGNORA o user_id do corpo', async () => {
  // O app manda user_id no corpo; o servidor não pode confiar nele.
  const id = await resolveUserId(`Bearer ${VALID_TOKEN}`, USER_ID, fakeGetUser);
  assertEquals(id, USER_ID);
});

Deno.test('resolveUserId: funciona sem user_id no corpo', async () => {
  const id = await resolveUserId(`Bearer ${VALID_TOKEN}`, undefined, fakeGetUser);
  assertEquals(id, USER_ID);
});

Deno.test('resolveUserId: 403 quando o corpo aponta OUTRO usuário (o IDOR)', async () => {
  const err = await assertRejects(
    () => resolveUserId(`Bearer ${VALID_TOKEN}`, OTHER_USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 403);
});

Deno.test('resolveUserId: 401 sem header Authorization', async () => {
  const err = await assertRejects(
    () => resolveUserId(null, USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('resolveUserId: 401 com token inválido ou expirado', async () => {
  const err = await assertRejects(
    () => resolveUserId('Bearer token-podre', USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('resolveUserId: 401 quando o getUser responde sem usuário', async () => {
  const semUsuario: GetUserFn = () =>
    Promise.resolve({ data: { user: null }, error: null });
  const err = await assertRejects(
    () => resolveUserId(`Bearer ${VALID_TOKEN}`, null, semUsuario),
    AuthError,
  );
  assertEquals(err.status, 401);
});

// --- assertServiceRole (funções internas) ---

Deno.test('assertServiceRole: aceita a service_role key', () => {
  assertServiceRole('Bearer service-key-secreta', 'service-key-secreta');
});

Deno.test('assertServiceRole: recusa a anon key', () => {
  const err = assertThrows(
    () => assertServiceRole('Bearer anon-key', 'service-key-secreta'),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('assertServiceRole: recusa header ausente', () => {
  assertThrows(() => assertServiceRole(null, 'service-key-secreta'), AuthError);
});

Deno.test('assertServiceRole: falha FECHADA quando a env não está configurada', () => {
  // Sem a chave no ambiente, ninguém entra — nunca o contrário.
  assertThrows(() => assertServiceRole('Bearer qualquer', undefined), AuthError);
  assertThrows(() => assertServiceRole('Bearer qualquer', ''), AuthError);
});

// --- BER-36: isServiceRole, o caminho alternativo do cron ---

Deno.test('isServiceRole: reconhece a chave correta', () => {
  assertEquals(isServiceRole('Bearer chave-secreta', 'chave-secreta'), true);
});

Deno.test('isServiceRole: recusa chave errada, header ausente e env ausente', () => {
  assertEquals(isServiceRole('Bearer outra-chave', 'chave-secreta'), false);
  assertEquals(isServiceRole(null, 'chave-secreta'), false);
  assertEquals(isServiceRole('Bearer chave-secreta', null), false);
  assertEquals(isServiceRole('Bearer chave-secreta', undefined), false);
});

Deno.test('isServiceRole: falha fechada — sem env configurada, ninguém é interno', () => {
  // O caso que importa: se a env sumir do deploy, o caminho interno não pode
  // virar uma porta aberta. Sem chave configurada, a resposta é sempre false.
  assertEquals(isServiceRole('Bearer qualquer-coisa', ''), false);
});

Deno.test('isServiceRole: um JWT de usuário não passa por interno', () => {
  assertEquals(isServiceRole('Bearer jwt.de.usuario', 'service-role-key'), false);
});
