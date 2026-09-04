// supabase/functions/evaluate-answer/prompt.test.ts
// BER-35: importa o módulo REAL. A versão anterior redefinia o prompt e uma
// `parseEvaluationJson` que nem existe mais no código — o parsing real vive em
// `_shared/ai-json.ts` desde a BER-37 e tem teste próprio.
import { assert, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildEvaluationPrompt, CONTENT_CONTEXT_CHARS } from './prompt.ts';

const CONTEUDO = 'Winston chega ao Ministério da Verdade. '.repeat(20);

Deno.test('buildEvaluationPrompt: não trata quem responde como aluno (BER-65)', () => {
  const prompt = buildEvaluationPrompt('O que mudou?', 'comprehension', 'Mudou tudo', CONTEUDO).toLowerCase();
  for (const proibido of ['ensino fundamental', 'aluno', 'estudante', 'professor', 'escola', 'encorajador']) {
    assert(!prompt.includes(proibido), `prompt não pode conter "${proibido}": ${prompt}`);
  }
});

Deno.test('buildEvaluationPrompt: pede devolutiva específica, não elogio', () => {
  const prompt = buildEvaluationPrompt('O que mudou?', 'reflection', 'Achei bom', CONTEUDO);
  assertStringIncludes(prompt, 'Sem elogio automático');
});

Deno.test('buildEvaluationPrompt: inclui pergunta e resposta', () => {
  const prompt = buildEvaluationPrompt('Por que Winston teme?', 'comprehension', 'Porque vigiam', CONTEUDO);
  assertStringIncludes(prompt, 'Por que Winston teme?');
  assertStringIncludes(prompt, 'Porque vigiam');
});

Deno.test('buildEvaluationPrompt: distingue compreensão de reflexão', () => {
  const comp = buildEvaluationPrompt('q', 'comprehension', 'a', CONTEUDO);
  const refl = buildEvaluationPrompt('q', 'reflection', 'a', CONTEUDO);
  assertStringIncludes(comp, 'COMPREENSÃO');
  assertStringIncludes(refl, 'REFLEXÃO');
  assertStringIncludes(refl, 'Não há resposta certa');
});

Deno.test('buildEvaluationPrompt: corta o conteúdo no limite de contexto', () => {
  const gigante = 'z'.repeat(CONTENT_CONTEXT_CHARS + 500);
  const prompt = buildEvaluationPrompt('q', 'comprehension', 'a', gigante);
  assert(!prompt.includes('z'.repeat(CONTENT_CONTEXT_CHARS + 1)), 'conteúdo deveria ter sido truncado');
  assertStringIncludes(prompt, 'z'.repeat(CONTENT_CONTEXT_CHARS));
});

Deno.test('buildEvaluationPrompt: mantém o formato JSON de saída', () => {
  const prompt = buildEvaluationPrompt('q', 'comprehension', 'a', CONTEUDO);
  assertStringIncludes(prompt, '{"score":');
  assertStringIncludes(prompt, '"feedback"');
});
