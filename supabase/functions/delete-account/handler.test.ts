// supabase/functions/delete-account/handler.test.ts
// BER-62: exclusão de conta — dado do leitor apagado explicitamente em todas as
// tabelas conhecidas, e só então a conta de autenticação.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
// auth.admin.deleteUser exige um UUID de verdade.
const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
}

function request(token: string | null = TOKEN): Request {
  return new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function fixture() {
  return {
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      profiles: [
        { user_id: USER_ID, display_name: 'Leitor' },
        { user_id: OTHER_USER_ID, display_name: 'Outro Leitor' },
      ],
      reading_sessions: [
        { id: 's1', user_id: USER_ID, book_id: 'book-1', end_page: 10 },
        { id: 's2', user_id: OTHER_USER_ID, book_id: 'book-1', end_page: 20 },
      ],
      student_books: [{ user_id: USER_ID, book_id: 'book-1' }],
      streaks: [{ user_id: USER_ID, current_streak: 5 }],
      answers: [
        { id: 'a1', user_id: USER_ID, question_id: 'q1' },
        { id: 'a2', user_id: OTHER_USER_ID, question_id: 'q1' },
      ],
      student_badges: [{ user_id: USER_ID, badge_id: 'b1' }],
      subscriptions: [{ user_id: USER_ID, plan_id: 'premium_monthly', status: 'active' }],
      // BER-100: a conversa com o assistente guarda a transcrição das páginas
      // fotografadas. Sem ela nesta lista, apagar a conta deixaria o texto do livro
      // do leitor para trás.
      assistant_conversations: [
        { id: 'conv-1', user_id: USER_ID, book_id: 'book-1' },
        { id: 'conv-2', user_id: OTHER_USER_ID, book_id: 'book-1' },
      ],
      assistant_messages: [
        { id: 'msg-1', conversation_id: 'conv-1', user_id: USER_ID, kind: 'page_text', content: 'trecho do 1984' },
        { id: 'msg-2', conversation_id: 'conv-2', user_id: OTHER_USER_ID, kind: 'page_text', content: 'trecho de outro' },
      ],
    },
  };
}

Deno.test('delete-account: sem Authorization devolve 401 e não apaga nada', async () => {
  const fake = startFakeSupabase(fixture());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(null));
    assertEquals(res.status, 401);
    assertEquals(fake.tables.profiles.length, 2);
    assertEquals(fake.deletedAuthUsers.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('delete-account: apaga só o dado do dono do JWT e a conta de auth, preservando os outros leitores', async () => {
  const fake = startFakeSupabase(fixture());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request());
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.deleted, true);

    // O leitor sumiu de toda tabela...
    assertEquals(fake.tables.profiles.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.reading_sessions.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.student_books.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.streaks.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.answers.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.student_badges.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.subscriptions.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.assistant_conversations.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.tables.assistant_messages.some((r) => r.user_id === USER_ID), false);
    assertEquals(fake.deletedAuthUsers, [USER_ID]);

    // ...mas o outro leitor não foi tocado.
    assertEquals(fake.tables.profiles.some((r) => r.user_id === OTHER_USER_ID), true);
    assertEquals(fake.tables.reading_sessions.some((r) => r.user_id === OTHER_USER_ID), true);
    assertEquals(fake.tables.answers.some((r) => r.user_id === OTHER_USER_ID), true);
    assertEquals(fake.tables.assistant_conversations.some((r) => r.user_id === OTHER_USER_ID), true);
    assertEquals(fake.tables.assistant_messages.some((r) => r.user_id === OTHER_USER_ID), true);
  } finally {
    await fake.close();
  }
});

Deno.test('delete-account: token inválido devolve 401 e não apaga nada', async () => {
  const fake = startFakeSupabase(fixture());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request('token-invalido'));
    assertEquals(res.status, 401);
    assertEquals(fake.tables.profiles.length, 2);
    assertEquals(fake.deletedAuthUsers.length, 0);
  } finally {
    await fake.close();
  }
});
