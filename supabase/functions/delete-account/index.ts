// supabase/functions/delete-account/index.ts
// BER-62: exigência de loja (Apple/Google exigem exclusão de conta dentro do
// app para qualquer app que permita criar conta) e direito de eliminação da
// LGPD (Art. 18). Não existia nenhum caminho de exclusão — só logout.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { notifyOps } from '../_shared/ops-alert.ts';

// Tabelas com dado do leitor, apagadas explicitamente antes da conta de auth.
// Não dependemos só de ON DELETE CASCADE: o schema vivo diverge dos arquivos de
// migration do repositório (BER-31), então esta lista é a evidência do que o
// código deste repositório realmente grava por user_id — não uma leitura do
// schema, que hoje não é confiável.
const USER_OWNED_TABLES = [
  'answers',
  'student_badges',
  'streaks',
  'student_books',
  'reading_sessions',
  'profiles',
] as const;

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();

  // Ação de auto-serviço: o dono da conta é sempre o JWT. Não há campo no
  // corpo para "de quem" apagar — não existe motivo legítimo para um caller
  // apagar a conta de outra pessoa por este caminho.
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

  for (const table of USER_OWNED_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', user_id);
    if (error) {
      await notifyOps('delete-account', `falha ao apagar ${table} do leitor ${user_id}: ${error.message}`);
      return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(user_id);
  if (authError) {
    // O dado do leitor já foi removido; só a conta de login ficou para trás.
    // Isso precisa de atenção humana — não é um estado seguro para deixar quieto.
    await notifyOps(
      'delete-account',
      `dados do leitor ${user_id} apagados, mas a conta de autenticação falhou: ${authError.message}`,
    );
    return new Response(JSON.stringify({ error: 'Failed to delete auth account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data: { deleted: true }, error: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
// Um teste que importa `handler` não pode abrir uma porta de verdade.
if (import.meta.main) Deno.serve(handler);
