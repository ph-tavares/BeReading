// supabase/functions/lookup-book-by-isbn/index.ts
// BER-72: dado o ISBN que o leitor informa ao cadastrar um livro fora do catálogo,
// devolve metadado bibliográfico (título, autor, editora, total de páginas) via
// Open Library. Não escreve em `books`: quem grava é o `add-book` (BER-60), com o
// que o leitor conferiu no formulário que este lookup preenche.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { firstAuthorKey, isValidIsbnFormat, normalizeIsbn, parseOpenLibraryEdition } from '../_shared/openlibrary.ts';

/** Capítulos da edição já ingerida com esse ISBN, ou null. Falhar aqui só deixa o campo vazio. */
async function knownChapterCount(supabase: ReturnType<typeof createServiceClient>, isbn: string): Promise<number | null> {
  const { data: edicoes } = await supabase.from('book_editions').select('id').eq('isbn', isbn).limit(1);
  const edicao = (edicoes ?? [])[0] as { id: string } | undefined;
  if (!edicao) return null;
  const { count } = await supabase.from('edition_chapters').select('id', { count: 'exact', head: true }).eq('edition_id', edicao.id);
  return count && count > 0 ? count : null;
}

/** Nome do autor pela chave da Open Library. Falhar aqui só deixa o autor em branco. */
async function resolveAuthorName(key: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${key}.json`);
    if (!res.ok) return null;
    const author = await res.json();
    return typeof author?.name === 'string' && author.name.trim() ? author.name.trim() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

  // Exige sessão válida — não é endpoint público. Sem isso, vira proxy gratuito
  // para a Open Library para qualquer um com a anon key (mesmo problema da BER-46).
  try {
    await resolveUserId(
      req.headers.get('Authorization'),
      null,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  let payload: { isbn?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.isbn) {
    return new Response(JSON.stringify({ error: 'Missing isbn' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isbn = normalizeIsbn(payload.isbn);
  if (!isValidIsbnFormat(isbn)) {
    return new Response(JSON.stringify({ error: 'Invalid ISBN format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let response: Response;
  try {
    response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  } catch (err) {
    console.error('Failed to reach Open Library:', err);
    return new Response(JSON.stringify({ error: 'Metadata provider unreachable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ISBN não encontrado é resultado válido, não erro — o leitor pode ter digitado
  // errado, ou o livro pode não estar catalogado ali. A tela decide o que fazer.
  if (response.status === 404) {
    return new Response(JSON.stringify({ data: { found: false }, error: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!response.ok) {
    console.error(`Open Library returned ${response.status} for isbn ${isbn}`);
    return new Response(JSON.stringify({ error: 'Metadata provider error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const json = await response.json();
  const metadata = parseOpenLibraryEdition(json);

  // BER-60: a maioria das edições só traz o autor por chave; sem esta segunda
  // chamada o formulário de cadastro chegava com o autor em branco.
  if (metadata.authors.length === 0) {
    const key = firstAuthorKey(json);
    const name = key ? await resolveAuthorName(key) : null;
    if (name) metadata.authors = [name];
  }

  // BER-59/60: edição já ingerida tem a estrutura confirmada; o formulário já vem com o número de
  // capítulos certo, e o `add-book` cria os capítulos iguais aos da edição.
  const chapterCount = await knownChapterCount(supabase, isbn);

  return new Response(JSON.stringify({
    data: { found: true, isbn, ...metadata, chapterCount },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
