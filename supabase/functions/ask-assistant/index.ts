// supabase/functions/ask-assistant/index.ts
// BER-101: o leitor toca numa sugestão ou digita a dúvida, e recebe uma resposta curta que o
// devolve ao livro.
//
// A conversa nasce no `scan-page` (BER-100), que grava a transcrição da página como primeira
// mensagem. Aqui ela continua: a pergunta entra, a resposta sai, e as duas ficam gravadas com
// modelo e tokens, para o custo ser medido e não estimado.
//
// **A linha do produto mora em `prompt.ts`**, não aqui: bloqueio responde direto, interpretação
// convida a pensar antes, pedido de resumo é recusado, e enredo sem lastro vira "não sei". O
// handler só cuida de quem pode falar, do que entra no contexto e do que fica gravado.
//
// **Fora desta issue, de propósito:** a cota por plano (BER-105) e a trava de spoiler por
// posição (BER-103). Até a BER-105, esta function não tem teto de custo.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { notifyOps } from '../_shared/ops-alert.ts';
import { AIOutOfCreditsError, callAI } from '../_shared/ai.ts';
import { buildConversationContext, readQuestion, type StoredMessage } from './conversation.ts';
import { buildAnswerPrompt, parseAnswer } from './prompt.ts';

/**
 * Mais alto que os 0.2 do `scan-page`, que é transcrição e não pode "melhorar" o texto, e mais
 * baixo que 1.0, onde o mesmo tipo de dúvida ganharia formatos diferentes a cada vez. Fica na
 * vizinhança dos 0.4 que a BER-55 escolheu para as perguntas do quiz, pelo mesmo motivo.
 */
const ANSWER_TEMPERATURE = 0.4;

/** Cabe a resposta curta que a spec pede, com folga para o JSON em volta. */
const ANSWER_MAX_TOKENS = 700;

/** A Edge Function morre em 150 s; uma resposta pendurada deixaria o leitor num spinner. */
const AI_TIMEOUT_MS = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// BER-49: exportado para o teste exercitar o handler de verdade, não uma cópia.
export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: { conversation_id?: unknown; question?: unknown; source_kind?: unknown; user_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createServiceClient();

  // O dono da ação vem do JWT, nunca do corpo (BER-30).
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

  const { conversation_id } = payload;
  if (typeof conversation_id !== 'string' || !conversation_id) {
    return json({ error: 'conversation_id required' }, 400);
  }

  const question = readQuestion(payload.question);
  if (!question) return json({ error: 'question required' }, 400);

  // Fonte da pergunta: a sugestão que veio da foto ou o campo de texto. Só rastreio — o
  // roteamento por tipo de dúvida é do prompt, não deste campo.
  const source_kind = payload.source_kind === 'photo' ? 'photo' : 'typed';

  // A conversa é buscada **pelo id e pelo dono ao mesmo tempo**. Filtrar só pelo id e conferir
  // o dono depois deixaria a janela do BER-30 aberta de novo; e responder 404 em vez de 403
  // não revela sequer que a conversa existe.
  const { data: conversas } = await supabase
    .from('assistant_conversations')
    .select('id, book_id, chapter_number, book_title_text')
    .eq('id', conversation_id)
    .eq('user_id', user_id)
    .limit(1);

  const conversa = conversas?.[0] as {
    id: string;
    book_id: string | null;
    chapter_number: number | null;
    book_title_text: string | null;
  } | undefined;
  if (!conversa) return json({ error: 'Conversation not found' }, 404);

  const { data: mensagens } = await supabase
    .from('assistant_messages')
    .select('role, kind, content')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true });

  const contexto = buildConversationContext((mensagens ?? []) as StoredMessage[]);

  // O título e o autor vêm do livro da estante quando existir; senão, do que o leitor digitou.
  let bookTitle: string | null = conversa.book_title_text;
  let author: string | null = null;
  if (conversa.book_id) {
    const { data: livros } = await supabase
      .from('books')
      .select('title, author')
      .eq('id', conversa.book_id)
      .limit(1);
    const livro = livros?.[0] as { title: string; author: string } | undefined;
    if (livro) {
      bookTitle = livro.title;
      author = livro.author;
    }
  }

  const prompt = buildAnswerPrompt({
    question,
    pageText: contexto.pageText,
    history: contexto.history,
    bookTitle,
    author,
    chapterNumber: conversa.chapter_number,
  });

  let resposta;
  let model: string;
  let usage;
  try {
    const saida = await callAI({
      prompt,
      maxTokens: ANSWER_MAX_TOKENS,
      temperature: ANSWER_TEMPERATURE,
      timeoutMs: AI_TIMEOUT_MS,
    });
    model = saida.model;
    usage = saida.usage;
    resposta = parseAnswer(saida.text);
  } catch (err) {
    if (err instanceof AIOutOfCreditsError) {
      await notifyOps('ask-assistant', `saldo de IA esgotado na conversa ${conversation_id}: ${err.message}`);
      return json({ error: 'ai_unavailable' }, 503);
    }
    // BER-39: falha que não deixa rastro é o que custou três meses no BER-27.
    await notifyOps('ask-assistant', `falha ao responder na conversa ${conversation_id}: ${err}`);
    return json({ error: 'answer_failed' }, 500);
  }

  // As duas mensagens entram juntas, e só depois de a resposta existir. Gravar a pergunta antes
  // deixaria a conversa com uma fala sem par toda vez que a IA falhasse.
  const agora = new Date().toISOString();
  const { error: insertError } = await supabase.from('assistant_messages').insert([
    {
      conversation_id,
      user_id,
      role: 'reader',
      kind: 'question',
      content: question,
      source_kind,
      created_at: agora,
    },
    {
      conversation_id,
      user_id,
      role: 'assistant',
      kind: 'answer',
      content: resposta.answer,
      model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      created_at: agora,
    },
  ]);

  if (insertError) {
    await notifyOps('ask-assistant', `resposta perdida na conversa ${conversation_id}: ${insertError.message}`);
    return json({ error: 'answer_failed' }, 500);
  }

  // A tela abre pela conversa mais recente (BER-102), então a hora da última fala precisa andar.
  await supabase
    .from('assistant_conversations')
    .update({ last_message_at: agora })
    .eq('id', conversation_id)
    .eq('user_id', user_id);

  return json({
    data: {
      conversation_id,
      kind: resposta.kind,
      answer: resposta.answer,
    },
    error: null,
  });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
