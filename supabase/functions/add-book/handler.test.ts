// supabase/functions/add-book/handler.test.ts
// BER-60: o leitor cadastra um livro fora do catálogo.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  // Os testes de cadastro não disparam a ingestão; os dela ligam explicitamente.
  Deno.env.set('BOOK_INGESTION_ON_ADD', 'off');
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/add-book', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const HOBBIT = { title: 'O Hobbit', author: 'J. R. R. Tolkien', total_pages: 300, chapter_count: 3, isbn: '9788595081145' };

Deno.test('add-book: cria o livro do leitor com capítulos de páginas estimadas', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();

    assertEquals(res.status, 201);
    assertEquals(json.data.created, true);
    assertEquals(fake.tables.books.length, 1);
    assertEquals(fake.tables.books[0].added_by, USER_ID);
    assertEquals(fake.tables.books[0].isbn, '9788595081145');
    const caps = fake.tables.chapters.map((c) => [c.number, c.start_page, c.end_page, c.book_id]);
    const id = fake.tables.books[0].id;
    assertEquals(caps, [[1, 1, 100, id], [2, 101, 200, id], [3, 201, 300, id]]);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: o dono vem do JWT, nunca do corpo', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ ...HOBBIT, added_by: 'outra-pessoa' }));
    assertEquals(res.status, 201);
    assertEquals(fake.tables.books[0].added_by, USER_ID);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: sem sessão, 401 e nada gravado', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT, null));
    await res.body?.cancel();
    assertEquals(res.status, 401);
    assertEquals(fake.tables.books.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: ISBN que já está no catálogo devolve o livro do catálogo, sem duplicar', async () => {
  const catalogo = { id: 'book-cat', title: 'O Hobbit', author: 'Tolkien', total_pages: 300, isbn: '9788595081145', added_by: null };
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [catalogo], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();
    assertEquals(res.status, 200);
    assertEquals(json.data.created, false);
    assertEquals(json.data.book.id, 'book-cat');
    assertEquals(fake.tables.books.length, 1);
    assertEquals(fake.tables.chapters.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: livro de outro leitor com o mesmo ISBN não vaza; cria o deste leitor', async () => {
  const alheio = { id: 'book-outro', title: 'O Hobbit', author: 'Tolkien', total_pages: 300, isbn: '9788595081145', added_by: 'user-2' };
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [alheio], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();
    assertEquals(res.status, 201);
    assertEquals(json.data.book.added_by, USER_ID);
    assertEquals(fake.tables.books.length, 2);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: entrada inválida é 400 e nada gravado', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ ...HOBBIT, chapter_count: 0 }));
    const json = await res.json();
    assertEquals(res.status, 400);
    assertEquals(json.error, 'Invalid chapter_count');
    assertEquals(fake.tables.books.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: teto de livros cadastrados por leitor', async () => {
  const meus = Array.from({ length: 50 }, (_, i) => ({ id: `b${i}`, added_by: USER_ID, isbn: null }));
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: meus, chapters: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ ...HOBBIT, isbn: undefined }));
    await res.body?.cancel();
    assertEquals(res.status, 429);
    assertEquals(fake.tables.books.length, 50);
  } finally {
    await fake.close();
  }
});

const EDICAO_1984 = { id: 'ed-1984', isbn: '9788535914849', book_id: 'book-catalogo' };
const CAPITULOS_1984 = [
  { id: 'e1', edition_id: 'ed-1984', number: 1, part_label: 'Parte 1', number_in_part: 1, title: null },
  { id: 'e2', edition_id: 'ed-1984', number: 2, part_label: 'Parte 1', number_in_part: 2, title: null },
  { id: 'e3', edition_id: 'ed-1984', number: 3, part_label: 'Parte 2', number_in_part: 1, title: null },
];

Deno.test('add-book: edição já ingerida define os capítulos, com o rótulo que a ponte do quiz lê (BER-59)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [], chapters: [], book_editions: [EDICAO_1984], edition_chapters: CAPITULOS_1984 },
  });
  withEnv(fake.url);
  Deno.env.delete('BOOK_INGESTION_ON_ADD');
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ title: '1984', author: 'George Orwell', total_pages: 300, chapter_count: 9, isbn: '9788535914849' }));
    const json = await res.json();
    assertEquals(res.status, 201);
    assertEquals([json.data.chapters, json.data.content], [3, 'edition']);
    assertEquals(fake.tables.chapters.map((c) => c.title), ['Parte 1 - Capítulo 1', 'Parte 1 - Capítulo 2', 'Parte 2 - Capítulo 1']);
    // Edição com estrutura não dispara ingestão.
    assertEquals(fake.calls.some((c) => c.path.startsWith('/functions/v1/ingest-book')), false);
  } finally {
    await fake.close();
  }
});

async function esperarChamada(fake: ReturnType<typeof startFakeSupabase>, prefixo: string) {
  for (let i = 0; i < 50; i++) {
    const call = fake.calls.find((c) => c.path.startsWith(prefixo));
    if (call) return call;
    await new Promise((r) => setTimeout(r, 20));
  }
  return undefined;
}

Deno.test('add-book: ISBN sem edição dispara a ingestão ligada a este livro (BER-59)', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [], book_editions: [] } });
  withEnv(fake.url);
  Deno.env.delete('BOOK_INGESTION_ON_ADD');
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();
    assertEquals(json.data.content, 'searching');
    const call = await esperarChamada(fake, '/functions/v1/ingest-book');
    assertEquals(call?.body, { isbn: '9788595081145', book_id: json.data.book.id });
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: edição existente sem estrutura roda de novo, sem repontar a edição', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { books: [], chapters: [], book_editions: [{ id: 'ed-x', isbn: '9788595081145', book_id: 'outro' }], edition_chapters: [] },
  });
  withEnv(fake.url);
  Deno.env.delete('BOOK_INGESTION_ON_ADD');
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();
    assertEquals([json.data.chapters, json.data.content], [3, 'searching']);
    const call = await esperarChamada(fake, '/functions/v1/ingest-book');
    assertEquals(call?.body, { isbn: '9788595081145', book_id: null });
  } finally {
    await fake.close();
  }
});

Deno.test('add-book: BOOK_INGESTION_ON_ADD=off não dispara', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: { books: [], chapters: [], book_editions: [] } });
  withEnv(fake.url);
  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request(HOBBIT));
    const json = await res.json();
    assertEquals(json.data.content, 'none');
    await new Promise((r) => setTimeout(r, 50));
    assertEquals(fake.calls.some((c) => c.path.startsWith('/functions/v1/ingest-book')), false);
  } finally {
    await fake.close();
  }
});
