// supabase/functions/reading-list/index.ts
// BER-58: começar e tirar um livro da leitura.
//
// Antes, o app gravava direto em `student_books` (policies da BER-28). Com o
// limite de livros simultâneos do plano gratuito, a gravação precisa passar pelo
// servidor — senão o limite é só visual. A migration da BER-61 removeu as policies
// de escrita do cliente.
//
// Tirar da leitura (`dropped`) libera a vaga e preserva `current_page`: se o
// leitor voltar ao livro, continua de onde parou.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { loadEntitlement } from '../_shared/entitlement.ts';
import { canStartBook, quotaExceededResponse } from '../_shared/plan-rules.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let payload: { action?: unknown; book_id?: unknown };
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

  const { action, book_id } = payload;
  if ((action !== 'start' && action !== 'stop') || typeof book_id !== 'string' || !book_id) {
    return json({ error: 'action (start|stop) and book_id required' }, 400);
  }

  const { data: rows } = await supabase
    .from('student_books')
    .select('id, status, current_page')
    .eq('user_id', user_id)
    .eq('book_id', book_id)
    .limit(1);
  const existing = rows?.[0] as { id: string; status: string; current_page: number } | undefined;

  if (action === 'stop') {
    if (!existing) return json({ error: 'Book not in reading list' }, 404);
    if (existing.status === 'finished') return json({ error: 'Book already finished' }, 409);

    if (existing.status !== 'dropped') {
      const { error } = await supabase
        .from('student_books')
        .update({ status: 'dropped' })
        .eq('id', existing.id);
      if (error) return json({ error: 'Failed to update reading list' }, 500);
    }
    return json({ data: { book_id, status: 'dropped', current_page: existing.current_page }, error: null });
  }

  // action === 'start'
  if (existing && existing.status !== 'dropped') {
    // Já está em leitura (ou terminado): nada muda e não gasta vaga de novo.
    return json({ data: { book_id, status: existing.status, current_page: existing.current_page }, error: null });
  }

  // BER-60: livro cadastrado por outro leitor não existe para quem não o cadastrou.
  // A service_role passa por cima da RLS de `books`, então a regra é repetida aqui.
  const { data: books } = await supabase.from('books').select('id, added_by').eq('id', book_id).limit(1);
  const book = books?.[0] as { added_by: string | null } | undefined;
  if (!book || (book.added_by && book.added_by !== user_id)) return json({ error: 'Book not found' }, 404);

  const entitlement = await loadEntitlement(supabase, user_id);
  const quota = canStartBook({
    premium: entitlement.premium,
    limits: entitlement.limits,
    bookId: book_id,
    activeBookIds: entitlement.activeBookIds,
  });
  if (!quota.allowed) {
    return quotaExceededResponse('active_books', quota, null);
  }

  if (existing) {
    const { error } = await supabase
      .from('student_books')
      .update({ status: 'reading' })
      .eq('id', existing.id);
    if (error) return json({ error: 'Failed to update reading list' }, 500);
    return json({ data: { book_id, status: 'reading', current_page: existing.current_page }, error: null });
  }

  const { error } = await supabase
    .from('student_books')
    .insert({ user_id, book_id, status: 'reading', current_page: 1 });
  if (error) return json({ error: 'Failed to update reading list' }, 500);

  return json({ data: { book_id, status: 'reading', current_page: 1 }, error: null });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
