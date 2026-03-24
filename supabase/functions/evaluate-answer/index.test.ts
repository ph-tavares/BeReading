// supabase/functions/evaluate-answer/index.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

function buildEvaluationPrompt(
  questionText: string,
  questionType: 'comprehension' | 'reflection',
  answerText: string,
  chapterContent: string
): string {
  const typeInstruction = questionType === 'comprehension'
    ? 'Esta é uma pergunta de COMPREENSÃO. Avalie se a resposta demonstra conhecimento correto do conteúdo do capítulo.'
    : 'Esta é uma pergunta de REFLEXÃO. Avalie a profundidade e coerência da reflexão. Não há resposta certa ou errada — avalie se o aluno engajou de verdade com a pergunta.';

  return `Você é um avaliador de leitura para estudantes do ensino fundamental.

Pergunta: ${questionText}
${typeInstruction}

Conteúdo do capítulo (contexto): ${chapterContent.substring(0, 2000)}

Resposta do aluno: ${answerText}

Retorne APENAS um JSON válido:
{"score": <0-100>, "feedback": "<1-2 frases encorajadoras em português>"}

Score 0-100 onde:
- 80-100: excelente, demonstra compreensão/reflexão profunda
- 60-79: boa resposta, com algumas lacunas
- 40-59: resposta parcial
- 0-39: muito superficial ou fora do contexto`;
}

function parseEvaluationJson(raw: string): { score: number; feedback: string } {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('No JSON found');
  const parsed = JSON.parse(match[0]);
  if (typeof parsed.score !== 'number' || typeof parsed.feedback !== 'string') {
    throw new Error('Invalid evaluation format');
  }
  return { score: Math.min(100, Math.max(0, parsed.score)), feedback: parsed.feedback };
}

Deno.test('buildEvaluationPrompt: compreensão menciona conhecimento do conteúdo', () => {
  const prompt = buildEvaluationPrompt('O que aconteceu?', 'comprehension', 'Algo aconteceu', 'texto');
  assertStringIncludes(prompt, 'COMPREENSÃO');
  assertStringIncludes(prompt, 'conhecimento correto');
});

Deno.test('buildEvaluationPrompt: reflexão não exige resposta certa', () => {
  const prompt = buildEvaluationPrompt('O que você faria?', 'reflection', 'Eu faria X', 'texto');
  assertStringIncludes(prompt, 'REFLEXÃO');
  assertStringIncludes(prompt, 'Não há resposta certa');
});

Deno.test('parseEvaluationJson: parseia JSON válido', () => {
  const raw = '{"score": 85, "feedback": "Muito bem! Você demonstrou boa compreensão."}';
  const result = parseEvaluationJson(raw);
  assertEquals(result.score, 85);
  assertStringIncludes(result.feedback, 'Muito bem');
});

Deno.test('parseEvaluationJson: clipa score acima de 100', () => {
  const raw = '{"score": 150, "feedback": "Incrível!"}';
  const result = parseEvaluationJson(raw);
  assertEquals(result.score, 100);
});

Deno.test('parseEvaluationJson: lança erro se JSON inválido', () => {
  let threw = false;
  try { parseEvaluationJson('sem json'); } catch { threw = true; }
  assertEquals(threw, true);
});
