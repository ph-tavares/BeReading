// supabase/functions/reading-list/handler.test.ts
// BER-58: começar e tirar livro da leitura, com o limite de livros simultâneos.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  Deno.env.delete('FREE_MAX_ACTIVE_BOOKS');
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/reading-list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const BOOKS = [{ id: 'book-1' }, { id: 'book-2' }, { id: 'book-3' }];

function reading(bookId: string, extra: Record<string, unknown> = {}) {
  return { id: `sb-${bookId}`, user_id: USER_ID, book_id: bookId, status: 'reading', current_page: 10, ...extra };
}

Deno.test('reading-list: começar um livro com vaga livre coloca em leitura na página 1', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-1' }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data, { book_id: 'book-1', status: 'reading', current_page: 1 });
    assertEquals(fake.tables.student_books.length, 1);
    assertEquals(fake.tables.student_books[0].status, 'reading');
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: gratuito com 2 livros em leitura não começa o terceiro — 402', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1'), reading('book-2')] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-3' }));
    const json = await res.json();

    assertEquals(res.status, 402);
    assertEquals(json.error, 'quota_exceeded');
    assertEquals(json.data, { reason: 'active_books', limit: 2, used: 2, resets_at: null });
    assertEquals(fake.tables.student_books.length, 2);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: começar um livro que já está em leitura não gasta vaga nem duplica', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1'), reading('book-2')] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-2' }));
    assertEquals(res.status, 200);
    assertEquals(fake.tables.student_books.length, 2);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: tirar um livro da leitura libera a vaga para outro, e o progresso fica salvo', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1', { current_page: 42 }), reading('book-2')] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');

    const stop = await handler(request({ action: 'stop', book_id: 'book-1' }));
    assertEquals(stop.status, 200);
    assertEquals((await stop.json()).data, { book_id: 'book-1', status: 'dropped', current_page: 42 });

    const start = await handler(request({ action: 'start', book_id: 'book-3' }));
    assertEquals(start.status, 200);

    const book1 = fake.tables.student_books.find((r) => r.book_id === 'book-1');
    assertEquals(book1?.status, 'dropped');
    assertEquals(book1?.current_page, 42);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: voltar a um livro tirado da leitura continua da página em que parou', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1', { status: 'dropped', current_page: 42 })] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-1' }));

    assertEquals(res.status, 200);
    assertEquals((await res.json()).data, { book_id: 'book-1', status: 'reading', current_page: 42 });
    assertEquals(fake.tables.student_books.length, 1);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: voltar a um livro tirado da leitura também respeita o limite', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      books: BOOKS,
      student_books: [reading('book-1'), reading('book-2'), reading('book-3', { status: 'dropped' })],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-3' }));
    assertEquals(res.status, 402);
    assertEquals(fake.tables.student_books.find((r) => r.book_id === 'book-3')?.status, 'dropped');
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: o limite de livros vem da env FREE_MAX_ACTIVE_BOOKS', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1'), reading('book-2')] },
  });
  withEnv(fake.url);
  Deno.env.set('FREE_MAX_ACTIVE_BOOKS', '3');

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-3' }));
    assertEquals(res.status, 200);
    assertEquals(fake.tables.student_books.length, 3);
  } finally {
    Deno.env.delete('FREE_MAX_ACTIVE_BOOKS');
    await fake.close();
  }
});

Deno.test('reading-list: Premium começa quantos livros quiser (BER-61)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      books: BOOKS,
      student_books: [reading('book-1'), reading('book-2')],
      subscriptions: [{
        user_id: USER_ID,
        plan_id: 'premium_monthly',
        status: 'active',
        provider: 'mock',
        current_period_start: new Date(Date.now() - 86400000).toISOString(),
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
        cancel_at_period_end: false,
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-3' }));
    assertEquals(res.status, 200);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: livro já terminado não é tirado da leitura — 409', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [reading('book-1', { status: 'finished' })] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'stop', book_id: 'book-1' }));
    assertEquals(res.status, 409);
    assertEquals(fake.tables.student_books[0].status, 'finished');
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: livro inexistente devolve 404', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-inexistente' }));
    assertEquals(res.status, 404);
    assertEquals(fake.tables.student_books.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: ação inválida devolve 400; sem Authorization devolve 401', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: BOOKS, student_books: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    assertEquals((await handler(request({ action: 'finish', book_id: 'book-1' }))).status, 400);
    assertEquals((await handler(request({ action: 'start', book_id: 'book-1' }, null))).status, 401);
    assertEquals(fake.tables.student_books.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: livro cadastrado por outro leitor não começa — 404 (BER-60)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [...BOOKS, { id: 'book-alheio', added_by: 'user-2' }], student_books: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-alheio' }));
    await res.body?.cancel();

    assertEquals(res.status, 404);
    assertEquals(fake.tables.student_books.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('reading-list: livro que o próprio leitor cadastrou começa normalmente (BER-60)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [{ id: 'book-meu', added_by: USER_ID }], student_books: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'start', book_id: 'book-meu' }));
    await res.body?.cancel();

    assertEquals(res.status, 200);
    assertEquals(fake.tables.student_books.length, 1);
  } finally {
    await fake.close();
  }
});
