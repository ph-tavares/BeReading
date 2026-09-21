// supabase/functions/ask-assistant/conversation.ts
// BER-101: o que da conversa gravada entra no prompt da proxima resposta.
//
// Regra pura, fora do handler, para ser testada de verdade (BER-35). Duas coisas moram aqui:
// o recorte do contexto e os tetos que impedem uma conversa longa de virar um prompt caro.

/** Uma linha de `assistant_messages`, no recorte que este modulo precisa. */
export interface StoredMessage {
  role: 'reader' | 'assistant';
  kind: 'question' | 'answer' | 'page_text';
  content: string;
}

/**
 * Teto da pergunta do leitor. Uma duvida sobre uma pagina cabe folgada nisto; acima disso
 * e colagem de texto, que e outro produto (e outro custo).
 */
export const MAX_QUESTION_CHARS = 500;

/** O mesmo teto que o `scan-page` usa para a transcricao, pelo mesmo motivo de custo. */
export const MAX_PAGE_TEXT_CHARS = 1200;

/**
 * Quantas falas anteriores entram. Seis cobre o ir e vir de uma duvida sem deixar o prompt
 * crescer sem limite: a spec pede resposta curta que devolve ao livro, nao uma sessao longa.
 */
export const MAX_HISTORY_MESSAGES = 6;

export interface ConversationContext {
  /** A transcricao da pagina fotografada. `null` quando a conversa comecou sem foto. */
  pageText: string | null;
  /** As falas anteriores, da mais antiga para a mais nova, ja recortadas. */
  history: { role: 'reader' | 'assistant'; content: string }[];
}

/**
 * Separa a ancora (a foto) do ir e vir (as perguntas e respostas).
 *
 * A transcricao nao entra no historico nem conta no teto dele: ela e o chao da conversa e
 * precisa estar presente na ultima pergunta tanto quanto na primeira. Foi por isso que ela
 * virou mensagem de `kind = 'page_text'` na BER-100, e nao uma coluna a parte — a ordem das
 * falas fica certa, e quem le sabe separar.
 */
export function buildConversationContext(messages: StoredMessage[]): ConversationContext {
  let pageText: string | null = null;
  const falas: { role: 'reader' | 'assistant'; content: string }[] = [];

  for (const message of messages) {
    if (message.kind === 'page_text') {
      // Se houver mais de uma foto na mesma conversa, vale a mais recente: e a pagina em que
      // o leitor esta agora.
      pageText = message.content.slice(0, MAX_PAGE_TEXT_CHARS);
      continue;
    }
    if (!message.content.trim()) continue;
    falas.push({ role: message.role, content: message.content });
  }

  return { pageText, history: falas.slice(-MAX_HISTORY_MESSAGES) };
}

/**
 * A pergunta do leitor, pronta para entrar no prompt.
 *
 * @returns `null` quando nao ha pergunta de verdade — o handler recusa com 400 em vez de
 * gastar uma chamada de IA com string vazia.
 */
export function readQuestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const texto = raw.trim();
  if (!texto) return null;
  return texto.slice(0, MAX_QUESTION_CHARS);
}
