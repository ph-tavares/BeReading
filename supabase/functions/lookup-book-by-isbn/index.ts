// supabase/functions/lookup-book-by-isbn/index.ts
// BER-72: dado o ISBN que o leitor informa ao cadastrar um livro fora do catálogo,
// devolve metadado bibliográfico (título, autor, editora, total de páginas) via
// Open Library. Não escreve em `books` — isso é fluxo da BER-60, ainda bloqueada
// pela decisão da BER-59. Esta function é só o lookup, consumível quando aquele
// fluxo existir.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { isValidIsbnFormat, normalizeIsbn, parseOpenLibraryEdition } from '../_shared/openlibrary.ts';

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

  return new Response(JSON.stringify({
    data: { found: true, isbn, ...metadata },
    error: null,
  }), { headers: { 'Content-Type': 'application/json' } });
});
