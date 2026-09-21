// supabase/functions/ask-assistant/conversation.test.ts
// BER-101: o recorte do que entra no prompt da proxima resposta.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildConversationContext,
  MAX_HISTORY_MESSAGES,
  MAX_PAGE_TEXT_CHARS,
  MAX_QUESTION_CHARS,
  readQuestion,
  type StoredMessage,
} from './conversation.ts';

function fala(role: 'reader' | 'assistant', kind: StoredMessage['kind'], content: string): StoredMessage {
  return { role, kind, content };
}

Deno.test('buildConversationContext: separa a foto do ir e vir', () => {
  const ctx = buildConversationContext([
    fala('reader', 'page_text', 'Quem controla o passado controla o futuro.'),
    fala('reader', 'question', 'o que é duplipensar'),
    fala('assistant', 'answer', 'É sustentar duas ideias contrárias ao mesmo tempo.'),
  ]);

  assertEquals(ctx.pageText, 'Quem controla o passado controla o futuro.');
  assertEquals(ctx.history, [
    { role: 'reader', content: 'o que é duplipensar' },
    { role: 'assistant', content: 'É sustentar duas ideias contrárias ao mesmo tempo.' },
  ]);
});

// A transcricao e o chao da conversa: precisa estar na ultima pergunta tanto quanto na primeira.
Deno.test('buildConversationContext: a foto nao entra no historico nem gasta o teto dele', () => {
  const muitas: StoredMessage[] = [fala('reader', 'page_text', 'trecho da pagina')];
  for (let i = 0; i < 20; i++) {
    muitas.push(fala('reader', 'question', `pergunta ${i}`));
  }

  const ctx = buildConversationContext(muitas);
  assertEquals(ctx.pageText, 'trecho da pagina');
  assertEquals(ctx.history.length, MAX_HISTORY_MESSAGES);
  // Ficam as mais RECENTES: a conversa continua de onde parou, nao do comeco.
  assertEquals(ctx.history[ctx.history.length - 1].content, 'pergunta 19');
});

Deno.test('buildConversationContext: com duas fotos, vale a mais recente', () => {
  const ctx = buildConversationContext([
    fala('reader', 'page_text', 'pagina 220'),
    fala('reader', 'question', 'o que é duplipensar'),
    fala('reader', 'page_text', 'pagina 240'),
  ]);
  assertEquals(ctx.pageText, 'pagina 240', 'é a página em que o leitor está agora');
});

Deno.test('buildConversationContext: conversa sem foto nenhuma nao inventa transcricao', () => {
  const ctx = buildConversationContext([fala('reader', 'question', 'o que é duplipensar')]);
  assertEquals(ctx.pageText, null);
});

Deno.test('buildConversationContext: corta transcricao gigante e descarta fala vazia', () => {
  const ctx = buildConversationContext([
    fala('reader', 'page_text', 'a'.repeat(5000)),
    fala('reader', 'question', '   '),
    fala('assistant', 'answer', 'resposta de verdade'),
  ]);
  assertEquals(ctx.pageText?.length, MAX_PAGE_TEXT_CHARS);
  assertEquals(ctx.history, [{ role: 'assistant', content: 'resposta de verdade' }]);
});

Deno.test('readQuestion: aceita pergunta de verdade e corta a gigante', () => {
  assertEquals(readQuestion('  o que é duplipensar  '), 'o que é duplipensar');
  assertEquals(readQuestion('a'.repeat(2000))?.length, MAX_QUESTION_CHARS);
});

// Sem isto, uma string vazia viraria uma chamada de IA paga por nada.
Deno.test('readQuestion: recusa o que não é pergunta', () => {
  assertEquals(readQuestion('   '), null);
  assertEquals(readQuestion(''), null);
  assertEquals(readQuestion(42), null);
  assertEquals(readQuestion(null), null);
  assertEquals(readQuestion(undefined), null);
});
