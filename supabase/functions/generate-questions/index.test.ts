// supabase/functions/generate-questions/index.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

function buildQuestionPrompt(
  bookTitle: string,
  author: string,
  chapterNumber: number,
  chapterTitle: string,
  contentText: string,
  grade: string,
  questionCount: number
): string {
  return `Você é um companheiro de leitura para estudantes do ensino fundamental (${grade}).
Gere ${questionCount} perguntas sobre o capítulo abaixo, sendo aproximadamente metade de compreensão e metade de reflexão.

Livro: ${bookTitle} — ${author}
Capítulo ${chapterNumber}: ${chapterTitle}
Conteúdo: ${contentText}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensão: verificam se o aluno leu e entendeu o que aconteceu
- Perguntas de reflexão: pedem opinião, conexão pessoal, pensamento crítico
- Linguagem adequada para ${grade}
- Retorne APENAS um array JSON válido: [{"type":"comprehension","question_text":"..."},{"type":"reflection","question_text":"..."}]`;
}

function parseQuestionsJson(raw: string): { type: string; question_text: string }[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response');
  return JSON.parse(match[0]);
}

Deno.test('buildQuestionPrompt: inclui título do livro', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', 'texto', '7o ano', 4);
  assertStringIncludes(prompt, '1984');
  assertStringIncludes(prompt, 'Orwell');
});

Deno.test('buildQuestionPrompt: inclui número de perguntas', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', 'texto', '7o ano', 4);
  assertStringIncludes(prompt, '4 perguntas');
});

Deno.test('parseQuestionsJson: parseia array JSON válido', () => {
  const raw = 'Resposta: [{"type":"comprehension","question_text":"O que aconteceu?"},{"type":"reflection","question_text":"O que você faria?"}]';
  const questions = parseQuestionsJson(raw);
  assertEquals(questions.length, 2);
  assertEquals(questions[0].type, 'comprehension');
});

Deno.test('parseQuestionsJson: lança erro se não há JSON', () => {
  let threw = false;
  try { parseQuestionsJson('sem json aqui'); } catch { threw = true; }
  assertEquals(threw, true);
});
