// supabase/functions/scan-page/index.ts
// BER-100: o leitor fotografa a página em que travou e recebe de volta a transcrição
// do trecho, 3 ou 4 perguntas escritas a partir daquela página, e o número impresso
// quando ele estiver legível.
//
// É a porta de entrada do assistente de leitura. A conversa que nasce aqui é
// continuada pelo `ask-assistant` (BER-101).
//
// Três coisas que esta função faz de propósito:
//   - **Não guarda a imagem.** Nem em tabela, nem em Storage. Ela existe em memória
//     durante a chamada e acaba com ela (spec §4.1). O que fica é o texto.
//   - **Falha fechada quando o modelo não enxerga.** Provedor ou modelo sem visão
//     vira erro claro e `notifyOps`, nunca uma resposta escrita sem olhar a foto
//     (`AGENTS.md` §3.8, o mesmo princípio do `BILLING_MODE` da BER-85).
//   - **Funciona sem o livro.** O catálogo tem 3 títulos e o leitor ainda não
//     consegue cadastrar o dele (BER-60), então sem `book_id` o assistente trabalha
//     só com a foto (decisão D20 da spec).
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { notifyOps } from '../_shared/ops-alert.ts';
import { AIImageUnsupportedError, AIOutOfCreditsError, callAI } from '../_shared/ai.ts';
import { buildScanPrompt } from './prompt.ts';
import { parseScanResult, SUGGESTION_COUNT } from './suggestions.ts';

/**
 * Teto do que aceitamos receber. O app já redimensiona para a borda maior na ordem de
 * 1.500 px antes de subir (spec §4.1), o que dá algo em torno de 300 KB — este limite
 * é a rede de segurança para quando ele não fizer isso, e bate com o teto de 5 MB por
 * imagem da Anthropic. Recusar aqui é mais barato que descobrir pelo 400 do provedor.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Transcrever é trabalho de precisão, não de criatividade: o custo de o modelo
 * "melhorar" o texto da página é alto e invisível. 0.2 é mais baixo que os 0.4 do
 * quiz (BER-55), onde variar as perguntas é desejável.
 */
const SCAN_TEMPERATURE = 0.2;

/** Cabe a transcrição (~1.200 caracteres) mais as quatro sugestões, com folga. */
const SCAN_MAX_TOKENS = 1200;

/**
 * A Edge Function morre em 150 s. Uma chamada pendurada levaria o leitor a olhar para
 * um spinner até o worker ser morto, sem mensagem nenhuma — mesmo raciocínio do
 * `timeoutMs` que a BER-59 trouxe para a ingestão.
 */
const AI_TIMEOUT_MS = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Tamanho real de um base64, sem alocar o binário inteiro só para medir. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

interface BookContext {
  id: string;
  title: string;
  author: string;
  totalPages: number | null;
}

// BER-49: exportado para o teste exercitar o handler de verdade, não uma cópia.
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: {
    image_base64?: unknown;
    image_media_type?: unknown;
    book_id?: unknown;
    book_title?: unknown;
    user_id?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createServiceClient();

  // O dono da ação vem do JWT, nunca do corpo (BER-30). O `user_id` do corpo só serve
  // para detectar divergência e recusar com 403.
  let user_id: string;
  try {
    user_id = await resolveUserId(
      req.headers.get('Authorization'),
      typeof payload.user_id === 'string' ? payload.user_id : undefined,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  const { image_base64, image_media_type, book_id, book_title } = payload;
  if (typeof image_base64 !== 'string' || !image_base64) {
    return json({ error: 'image_base64 required' }, 400);
  }
  if (typeof image_media_type !== 'string' || !image_media_type) {
    return json({ error: 'image_media_type required' }, 400);
  }
  if (book_id !== undefined && typeof book_id !== 'string') {
    return json({ error: 'book_id must be a string' }, 400);
  }
  if (base64Bytes(image_base64) > MAX_IMAGE_BYTES) {
    return json({ error: 'image_too_large' }, 413);
  }

  // Contexto do livro, quando ele existir. Sem ele o assistente segue, só sem saber
  // que livro é (D20) — não é erro, é degradação combinada.
  let book: BookContext | null = null;
  let registeredPage: number | null = null;

  if (typeof book_id === 'string') {
    const { data: row } = await supabase
      .from('books')
      .select('id, title, author, total_pages')
      .eq('id', book_id)
      .limit(1);
    const found = row?.[0] as { id: string; title: string; author: string; total_pages: number } | undefined;
    if (!found) return json({ error: 'Book not found' }, 404);
    book = { id: found.id, title: found.title, author: found.author, totalPages: found.total_pages ?? null };

    // Até onde ele registrou. O livro pode estar no catálogo sem estar na estante
    // deste leitor — aí seguimos com o título e sem a posição.
    const { data: shelf } = await supabase
      .from('student_books')
      .select('current_page')
      .eq('user_id', user_id)
      .eq('book_id', book_id)
      .limit(1);
    registeredPage = (shelf?.[0] as { current_page: number } | undefined)?.current_page ?? null;
  }

  // Título digitado pelo leitor, quando o livro não está no catálogo. Entra no prompt
  // como dado delimitado, nunca como instrução (spec §6.4).
  const typedTitle = typeof book_title === 'string' && book_title.trim() ? book_title.trim() : null;

  const prompt = buildScanPrompt({
    bookTitle: book?.title ?? typedTitle,
    author: book?.author ?? null,
    registeredPage,
    totalPages: book?.totalPages ?? null,
  }, SUGGESTION_COUNT);

  let scan;
  let model: string;
  let usage;
  try {
    const resposta = await callAI({
      prompt,
      maxTokens: SCAN_MAX_TOKENS,
      temperature: SCAN_TEMPERATURE,
      timeoutMs: AI_TIMEOUT_MS,
      image: { base64: image_base64, mediaType: image_media_type },
    });
    model = resposta.model;
    usage = resposta.usage;
    scan = parseScanResult(resposta.text, book?.totalPages ?? null);
  } catch (err) {
    // Configuração: o caminho de imagem não existe ou o modelo não tem visão. Isso não
    // se resolve com nova tentativa do leitor, e é o time que precisa saber.
    if (err instanceof AIImageUnsupportedError) {
      await notifyOps('scan-page', `provedor de IA sem suporte a imagem: ${err.message}`);
      return json({ error: 'ai_image_unsupported' }, 503);
    }
    if (err instanceof AIOutOfCreditsError) {
      await notifyOps('scan-page', `saldo de IA esgotado ao ler a foto do leitor ${user_id}: ${err.message}`);
      return json({ error: 'ai_unavailable' }, 503);
    }
    // BER-39: falha que não deixa rastro é o que custou três meses no BER-27.
    await notifyOps('scan-page', `falha ao ler a foto do leitor ${user_id}: ${err}`);
    return json({ error: 'scan_failed' }, 500);
  }

  // A foto não é página de livro. Recusa curta e **nada é gravado** — nem conversa,
  // nem mensagem. Não é falha nossa, então também não acorda ninguém (spec §7).
  if (!scan.isBookPage) {
    return json({ error: 'not_a_book_page' }, 422);
  }

  if (scan.rejected.length > 0) {
    console.warn(
      `[scan-page] ${scan.rejected.length} sugestão(ões) descartada(s):`,
      scan.rejected.map((r) => r.reason).join(' | '),
    );
  }

  // O capítulo em que a página detectada cai, quando dá para saber. É contexto para a
  // conversa; a oferta de registrar até ali é a BER-104.
  let chapterNumber: number | null = null;
  if (book && scan.detectedPage !== null) {
    const { data: chapters } = await supabase
      .from('chapters')
      .select('number')
      .eq('book_id', book.id)
      .lte('start_page', scan.detectedPage)
      .gte('end_page', scan.detectedPage)
      .limit(1);
    chapterNumber = (chapters?.[0] as { number: number } | undefined)?.number ?? null;
  }

  const { data: created, error: conversationError } = await supabase
    .from('assistant_conversations')
    .insert({
      user_id,
      book_id: book?.id ?? null,
      book_title_text: book ? null : typedTitle,
      chapter_number: chapterNumber,
      detected_page: scan.detectedPage,
    })
    .select('id')
    .single();

  if (conversationError || !created) {
    await notifyOps('scan-page', `falha ao abrir conversa do leitor ${user_id}: ${conversationError?.message}`);
    return json({ error: 'scan_failed' }, 500);
  }

  const conversationId = (created as { id: string }).id;

  // A transcrição entra como mensagem da conversa, e não em coluna própria: mantém a
  // ordem das falas e evita uma tabela só para isso (spec §5).
  const { error: messageError } = await supabase.from('assistant_messages').insert({
    conversation_id: conversationId,
    user_id,
    role: 'reader',
    kind: 'page_text',
    content: scan.pageText,
    source_kind: 'photo',
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  });

  if (messageError) {
    await notifyOps('scan-page', `conversa ${conversationId} aberta sem a transcrição: ${messageError.message}`);
    return json({ error: 'scan_failed' }, 500);
  }

  return json({
    data: {
      conversation_id: conversationId,
      page_text: scan.pageText,
      suggestions: scan.suggestions,
      detected_page: scan.detectedPage,
      chapter_number: chapterNumber,
      registered_page: registeredPage,
      book: book ? { id: book.id, title: book.title, author: book.author } : null,
      book_title_text: book ? null : typedTitle,
    },
    error: null,
  });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
