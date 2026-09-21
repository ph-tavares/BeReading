// supabase/functions/add-book/index.ts
// BER-60: o leitor cadastra um livro que não está no catálogo.
//
// Grava o livro (visível só para quem cadastrou, ver a migration
// 20260921200000_ber60_livro_do_leitor.sql) e os capítulos com páginas estimadas.
// Não coloca o livro em leitura: o app chama `reading-list` em seguida, e é lá que
// mora a cota de livros simultâneos do plano gratuito (BER-58). Assim a cota tem
// um lugar só.
//
// Conteúdo de capítulo: livro novo não tem `book_contents`, então o quiz cai no
// estado honesto de "sem conteúdo" (BER-66) — a não ser que a ingestão por ISBN
// (BER-59) confirme fatos do capítulo. O disparo dela daqui é opcional e desligado
// por padrão (secret BOOK_INGESTION_ON_ADD=on): cada run gasta IA e busca por
// dezenas de minutos, e ninguém decidiu ainda pagar isso por cadastro.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { dispatchBackground } from '../_shared/background.ts';
import { internalCallHeaders } from '../_shared/keys.ts';
import { estimateChapters, findVisibleByIsbn, LIMITS, parseAddBookInput } from './book.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BOOK_COLUMNS = 'id, title, author, cover_url, total_pages, genre, created_at, isbn, added_by';

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createServiceClient();

  let user_id: string;
  try {
    user_id = await resolveUserId(
      req.headers.get('Authorization'),
      undefined,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  const parsed = parseAddBookInput(payload);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const input = parsed.input;

  // Mesmo ISBN que o leitor já enxerga: devolve o livro que existe em vez de duplicar.
  if (input.isbn) {
    const { data: rows, error } = await supabase.from('books').select(BOOK_COLUMNS).eq('isbn', input.isbn);
    if (error) return json({ error: 'Failed to add book' }, 500);
    const existing = findVisibleByIsbn((rows ?? []) as { added_by: string | null }[], user_id);
    if (existing) return json({ data: { book: existing, created: false }, error: null });
  }

  const { data: mine, error: countError } = await supabase.from('books').select('id').eq('added_by', user_id);
  if (countError) return json({ error: 'Failed to add book' }, 500);
  if ((mine ?? []).length >= LIMITS.booksPerReader) {
    return json({ error: 'Too many books added' }, 429);
  }

  const { data: created, error: bookError } = await supabase
    .from('books')
    .insert({
      title: input.title,
      author: input.author,
      total_pages: input.totalPages,
      cover_url: input.coverUrl,
      isbn: input.isbn,
      added_by: user_id,
    })
    .select(BOOK_COLUMNS)
    .single();
  if (bookError || !created) {
    console.error('[add-book] falha ao gravar o livro:', bookError?.message);
    return json({ error: 'Failed to add book' }, 500);
  }
  const book = created as { id: string };

  const chapters = estimateChapters(input.totalPages, input.chapterCount)
    .map((c) => ({ ...c, book_id: book.id }));
  const { error: chaptersError } = await supabase.from('chapters').insert(chapters);
  if (chaptersError) {
    // Livro sem capítulo não fecha capítulo nem gera quiz: melhor não existir.
    console.error('[add-book] falha ao gravar os capítulos:', chaptersError.message);
    await supabase.from('books').delete().eq('id', book.id);
    return json({ error: 'Failed to add book' }, 500);
  }

  if (input.isbn) await maybeStartIngestion(supabase, input.isbn, book.id);

  return json({ data: { book: created, created: true }, error: null }, 201);
}

/**
 * Dispara a ingestão por ISBN (BER-59), quando ligada. Só para edição que ainda não
 * existe: o `ingest-book` repontaria uma edição já ingerida (ligada a outro livro,
 * por exemplo o do catálogo) para este livro novo.
 */
async function maybeStartIngestion(
  supabase: ReturnType<typeof createServiceClient>,
  isbn: string,
  bookId: string,
): Promise<void> {
  if (Deno.env.get('BOOK_INGESTION_ON_ADD') !== 'on') return;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return;

  const { data: editions } = await supabase.from('book_editions').select('id').eq('isbn', isbn).limit(1);
  if ((editions ?? []).length > 0) return;

  dispatchBackground('ingest-book', () =>
    fetch(`${supabaseUrl}/functions/v1/ingest-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalCallHeaders((name) => Deno.env.get(name)),
      },
      body: JSON.stringify({ isbn, book_id: bookId }),
    }));
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
