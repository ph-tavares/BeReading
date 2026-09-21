// supabase/functions/add-book/index.ts
// BER-60: o leitor cadastra um livro que não está no catálogo.
//
// Grava o livro (visível só para quem cadastrou, ver a migration
// 20260921200000_ber60_livro_do_leitor.sql) e os capítulos com páginas estimadas.
// Não coloca o livro em leitura: o app chama `reading-list` em seguida, e é lá que
// mora a cota de livros simultâneos do plano gratuito (BER-58). Assim a cota tem
// um lugar só.
//
// Conteúdo de capítulo: livro novo não tem `book_contents`. Com ISBN, o cadastro dispara a
// ingestão (BER-59), que busca e confirma os fatos de cada capítulo em fontes independentes;
// quando o run fecha, o `publish` ajusta os capítulos deste livro à estrutura da edição e gera
// de novo o quiz que tinha ficado sem conteúdo (`_shared/ingestion/app-sync.ts`). Até lá, e
// sem ISBN, o quiz cai no estado honesto de "sem conteúdo" (BER-66).
//
// A ingestão liga por padrão. O custo tem teto por run (US$ 3) e por dia (10 runs novos, cota
// do Tavily) em `_shared/ingestion/budget.ts`; para desligar só o disparo do cadastro,
// BOOK_INGESTION_ON_ADD=off, e para desligar a ingestão inteira, INGESTION_ENABLED=false.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { dispatchBackground } from '../_shared/background.ts';
import { internalCallHeaders } from '../_shared/keys.ts';
import { ingestionDisabled } from '../_shared/ingestion/kill-switch.ts';
import { appChapterTitle } from '../_shared/ingestion/app-sync.ts';
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

  // Edição já ingerida (outro leitor cadastrou o mesmo ISBN, ou o time rodou a ingestão): os
  // capítulos nascem iguais aos dela, e o quiz usa o conhecimento desde o primeiro capítulo.
  const edicao = input.isbn ? await editionStructure(supabase, input.isbn) : null;
  const daEdicao = edicao && edicao.chapters.length > 0 && edicao.chapters.length <= input.totalPages;
  const chapters = (daEdicao
    ? estimateChapters(input.totalPages, edicao.chapters.length).map((c, i) => ({ ...c, title: appChapterTitle(edicao.chapters[i]) }))
    : estimateChapters(input.totalPages, input.chapterCount))
    .map((c) => ({ ...c, book_id: book.id }));
  const { error: chaptersError } = await supabase.from('chapters').insert(chapters);
  if (chaptersError) {
    // Livro sem capítulo não fecha capítulo nem gera quiz: melhor não existir.
    console.error('[add-book] falha ao gravar os capítulos:', chaptersError.message);
    await supabase.from('books').delete().eq('id', book.id);
    return json({ error: 'Failed to add book' }, 500);
  }

  // Edição que existe sem estrutura (runs anteriores não confirmaram) roda de novo, sem `book_id`:
  // ela pode servir a outro livro, e o `publish` acha este pelo ISBN. O `ingest-book` recusa com
  // 409 se já houver run em andamento.
  const ingestao = input.isbn && !daEdicao ? startIngestion(input.isbn, edicao ? null : book.id) : false;

  return json({
    data: {
      book: created,
      created: true,
      chapters: chapters.length,
      // Para o app dizer ao leitor o que esperar do quiz.
      content: daEdicao ? 'edition' : ingestao ? 'searching' : 'none',
    },
    error: null,
  }, 201);
}

interface EditionStructure {
  chapters: { id: string; number: number; partLabel: string | null; numberInPart: number | null; title: string | null }[];
}

/** Estrutura da edição já ingerida com esse ISBN, ou null se a edição ainda não existe. */
async function editionStructure(
  supabase: ReturnType<typeof createServiceClient>,
  isbn: string,
): Promise<EditionStructure | null> {
  const { data: edicoes } = await supabase.from('book_editions').select('id').eq('isbn', isbn).limit(1);
  const edicao = (edicoes ?? [])[0] as { id: string } | undefined;
  if (!edicao) return null;
  const { data } = await supabase
    .from('edition_chapters')
    .select('id, number, part_label, number_in_part, title')
    .eq('edition_id', edicao.id)
    .order('number');
  const rows = (data ?? []) as { id: string; number: number; part_label: string | null; number_in_part: number | null; title: string | null }[];
  return { chapters: rows.map((r) => ({ id: r.id, number: r.number, partLabel: r.part_label, numberInPart: r.number_in_part, title: r.title })) };
}

/**
 * Dispara a ingestão por ISBN (BER-59). `bookId` só para edição nova: numa edição que já existe, o
 * `ingest-book` a repontaria para este livro, tirando-a do livro a que ela já serve; o livro novo
 * usa o conhecimento dela pelo ISBN (`chapter-grounding.ts`).
 */
function startIngestion(isbn: string, bookId: string | null): boolean {
  if (Deno.env.get('BOOK_INGESTION_ON_ADD')?.trim().toLowerCase() === 'off') return false;
  if (ingestionDisabled(Deno.env.get('INGESTION_ENABLED'))) return false;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return false;

  dispatchBackground('ingest-book', async () => {
    const res = await fetch(`${supabaseUrl}/functions/v1/ingest-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalCallHeaders((name) => Deno.env.get(name)),
      },
      body: JSON.stringify({ isbn, book_id: bookId }),
    });
    // 429 (limite diário de runs) e 503 (ingestão desligada) não são falha do cadastro, mas têm
    // de aparecer no log: é o motivo de um livro ficar sem conteúdo.
    if (!res.ok) console.error(`[add-book] ingest-book devolveu ${res.status} para o ISBN ${isbn}`);
    await res.body?.cancel();
  });
  return true;
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
