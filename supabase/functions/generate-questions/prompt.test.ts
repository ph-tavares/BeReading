// supabase/functions/generate-questions/prompt.test.ts
// Testa o módulo REAL (BER-35): estes testes importam `prompt.ts`, não uma cópia
// da lógica declarada aqui dentro. A versão anterior deste arquivo redefinia
// `buildQuestionPrompt` localmente — e chegou a testar uma `parseQuestionsJson`
// que já nem existia mais no código, com a regex não-gulosa que a BER-37 corrigiu.
import {
  assert,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildQuestionPrompt } from './prompt.ts';

const CONTEUDO = 'x'.repeat(600);

// ---------------------------------------------------------------------------
// BER-65 — o prompt fala com leitor adulto, não com aluno do fundamental
// ---------------------------------------------------------------------------

Deno.test('buildQuestionPrompt: não menciona escola, série ou aluno', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', CONTEUDO, 4).toLowerCase();
  const proibidos = [
    'ensino fundamental', 'aluno', 'estudante', 'professor',
    'escola', 'série', 'lição', '7o', '8o', '9o',
  ];
  for (const proibido of proibidos) {
    assert(
      !prompt.includes(proibido),
      `prompt não pode conter "${proibido}" — o público é leitor adulto (BER-65). Prompt: ${prompt}`,
    );
  }
});

Deno.test('buildQuestionPrompt: mantém o tom de conversa, não de prova', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', CONTEUDO, 4);
  assertStringIncludes(prompt, 'nunca de prova');
});

Deno.test('buildQuestionPrompt: inclui livro, autor, capítulo e conteúdo', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 7, 'A sala 101', CONTEUDO, 4);
  assertStringIncludes(prompt, '1984');
  assertStringIncludes(prompt, 'Orwell');
  assertStringIncludes(prompt, '7');
  assertStringIncludes(prompt, 'A sala 101');
  assertStringIncludes(prompt, CONTEUDO);
});

Deno.test('buildQuestionPrompt: pede a contagem de perguntas recebida', () => {
  assertStringIncludes(buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', CONTEUDO, 4), '4 perguntas');
  assertStringIncludes(buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', CONTEUDO, 6), '6 perguntas');
});

Deno.test('buildQuestionPrompt: mantém os dois tipos e o formato JSON de saída', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', CONTEUDO, 4);
  assertStringIncludes(prompt, 'comprehension');
  assertStringIncludes(prompt, 'reflection');
});
