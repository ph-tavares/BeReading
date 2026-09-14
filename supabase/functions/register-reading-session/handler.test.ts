// supabase/functions/register-reading-session/handler.test.ts
// BER-49: cobertura de handler (IO, Supabase, background dispatch) que faltava —
// reading.test.ts cobre só a lógica pura. Roda contra um fake Supabase local
// (ver _shared/test-support/fakeSupabase.ts), não o real.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { getTodayInSaoPaulo } from './reading.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
}

/** Espera o event loop girar — o dispatch em segundo plano não é aguardado pelo handler. */
async function flushBackgroundTasks() {
  await new Promise((r) => setTimeout(r, 20));
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/register-reading-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// O dispatch em segundo plano (award-badges, generate-questions) é fire-and-forget
// de propósito (BER-27): o handler não consome o corpo da resposta. O sanitizador
// de recursos do Deno.test acusaria isso como vazamento sem ser um bug real — por
// isso os testes que criam sessão com sucesso desligam `sanitizeResources`/`sanitizeOps`.

Deno.test({
  name: 'register-reading-session: caminho feliz — cria sessão, inicia a sequência e dispara o quiz do capítulo completo',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const fake = startFakeSupabase({
      users: { [TOKEN]: { id: USER_ID } },
      tables: {
        books: [{ id: 'book-1', total_pages: 300 }],
        reading_sessions: [],
        student_books: [],
        streaks: [],
        chapters: [{ id: 'ch-1', book_id: 'book-1', number: 1, end_page: 50 }],
        chapter_quiz_status: [],
      },
    });
    withEnv(fake.url);

    try {
      const { handler } = await import('./index.ts');
      const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 1, end_page: 50 }));
      const json = await res.json();

      assertEquals(res.status, 200);
      assertEquals(json.data.session_created, true);
      assertEquals(json.data.new_max_page, 50);
      assertEquals(json.data.current_streak, 1);
      assertEquals(json.data.longest_streak, 1);
      assertEquals(json.data.completed_chapter_ids, ['ch-1']);

      assertEquals(fake.tables.reading_sessions.length, 1);
      assertEquals(fake.tables.reading_sessions[0].pages_read, 50); // BER-68
      assertEquals(fake.tables.streaks.length, 1);
      assertEquals(fake.tables.streaks[0].current_streak, 1);

      await flushBackgroundTasks();
      const dispatched = fake.calls.find((c) => c.path.startsWith('/functions/v1/generate-questions'));
      assertEquals(dispatched?.body, { chapter_id: 'ch-1' });
    } finally {
      await fake.close();
    }
  },
});

Deno.test('register-reading-session: livro inexistente devolve 404 e não cria sessão', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [], reading_sessions: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ user_id: USER_ID, book_id: 'book-inexistente', start_page: 1, end_page: 10 }));
    assertEquals(res.status, 404);
    assertEquals(fake.tables.reading_sessions.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('register-reading-session: end_page maior que o total do livro devolve 400', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [{ id: 'book-1', total_pages: 100 }], reading_sessions: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 1, end_page: 200 }));
    assertEquals(res.status, 400);
    assertEquals(fake.tables.reading_sessions.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('register-reading-session: sem Authorization devolve 401', async () => {
  const fake = startFakeSupabase({ tables: { books: [{ id: 'book-1', total_pages: 100 }] } });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 1, end_page: 10 }, null));
    assertEquals(res.status, 401);
  } finally {
    await fake.close();
  }
});

Deno.test('register-reading-session: user_id do corpo diferente do JWT devolve 403 (BER-30)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [{ id: 'book-1', total_pages: 100 }], reading_sessions: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ user_id: 'outro-usuario', book_id: 'book-1', start_page: 1, end_page: 10 }));
    assertEquals(res.status, 403);
    assertEquals(fake.tables.reading_sessions.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test({
  name: 'register-reading-session: leu ontem — sequência incrementa a partir do que já existia',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const today = getTodayInSaoPaulo();
    const yesterday = getTodayInSaoPaulo(new Date(new Date(`${today}T12:00:00.000Z`).getTime() - 24 * 3600000));

    const fake = startFakeSupabase({
      users: { [TOKEN]: { id: USER_ID } },
      tables: {
        books: [{ id: 'book-1', total_pages: 300 }],
        reading_sessions: [],
        student_books: [],
        chapters: [],
        streaks: [{ id: 's1', user_id: USER_ID, current_streak: 3, longest_streak: 5, last_read_date: yesterday }],
      },
    });
    withEnv(fake.url);

    try {
      const { handler } = await import('./index.ts');
      const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 1, end_page: 10 }));
      const json = await res.json();

      assertEquals(json.data.current_streak, 4);
      assertEquals(json.data.longest_streak, 5);

      await flushBackgroundTasks();
    } finally {
      await fake.close();
    }
  },
});

Deno.test('register-reading-session: reler um trecho já registrado não soma páginas de novo no XP (BER-68)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      books: [{ id: 'book-1', total_pages: 300 }],
      reading_sessions: [{ id: 's0', user_id: USER_ID, book_id: 'book-1', end_page: 50 }],
      student_books: [],
      chapters: [],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    // já leu até a página 50; registra 30-50 de novo (releitura completa)
    const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 30, end_page: 50 }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.new_max_page, 50);
    assertEquals(fake.tables.reading_sessions.length, 2);
    assertEquals(fake.tables.reading_sessions[1].pages_read, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('register-reading-session: intervalo parcialmente sobreposto conta só a parte nova (BER-68)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      books: [{ id: 'book-1', total_pages: 300 }],
      reading_sessions: [{ id: 's0', user_id: USER_ID, book_id: 'book-1', end_page: 50 }],
      student_books: [],
      chapters: [],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    // já leu até 50; registra 30-80 -> só 51-80 (30 páginas) são novas
    const res = await handler(request({ user_id: USER_ID, book_id: 'book-1', start_page: 30, end_page: 80 }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(fake.tables.reading_sessions[1].pages_read, 30);
  } finally {
    await fake.close();
  }
});
