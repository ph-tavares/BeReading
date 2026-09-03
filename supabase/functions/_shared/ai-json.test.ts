// supabase/functions/_shared/ai-json.test.ts
import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { extractJson, parseEvaluation, parseQuestions } from './ai-json.ts';

// --- BER-37: o texto da IA contém ] ou } ---

Deno.test('parseQuestions: NÃO trunca quando a pergunta contém "]"', () => {
  // O caso que quebrava: a regex não-gulosa parava no ] dentro do texto.
  const raw = `[
    {"type": "comprehension", "question_text": "O que Coraline sente [medo] ao cruzar a porta?"},
    {"type": "reflection", "question_text": "E você, o que faria?"}
  ]`;
  const { valid, rejected } = parseQuestions(raw);
  assertEquals(valid.length, 2);
  assertEquals(rejected.length, 0);
  assertEquals(valid[1].question_text, 'E você, o que faria?');
});

Deno.test('parseEvaluation: NÃO trunca quando o feedback contém "}"', () => {
  const raw = '{"score": 80, "feedback": "Boa! O trecho {citado} mostra que entendeu."}';
  const parsed = parseEvaluation(raw);
  assertEquals(parsed.score, 80);
  assertEquals(parsed.feedback, 'Boa! O trecho {citado} mostra que entendeu.');
});

Deno.test('extractJson: aceita resposta embrulhada em cerca de markdown', () => {
  const raw = '```json\n[{"type":"reflection","question_text":"Por quê?"}]\n```';
  assertEquals(extractJson(raw, 'array'), [
    { type: 'reflection', question_text: 'Por quê?' },
  ]);
});

Deno.test('extractJson: aceita texto de conversa antes e depois do JSON', () => {
  const raw = 'Claro! Aqui estão as perguntas:\n[{"a":1}]\nEspero ter ajudado.';
  assertEquals(extractJson(raw, 'array'), [{ a: 1 }]);
});

Deno.test('extractJson: erro claro quando não há JSON nenhum', () => {
  assertThrows(() => extractJson('desculpe, não consegui', 'array'), Error);
});

// --- BER-38: uma pergunta ruim não derruba o lote ---

Deno.test('parseQuestions: descarta só a inválida e preserva as demais', () => {
  const raw = `[
    {"type": "comprehension", "question_text": "Pergunta boa 1"},
    {"type": "multiple_choice", "question_text": "Tipo fora do CHECK do banco"},
    {"type": "reflection", "question_text": "Pergunta boa 2"}
  ]`;
  const { valid, rejected } = parseQuestions(raw);
  // Antes: o insert do lote inteiro falhava e o capítulo virava `failed`.
  assertEquals(valid.length, 2);
  assertEquals(rejected.length, 1);
  assertEquals(rejected[0].reason.includes('type inválido'), true);
});

Deno.test('parseQuestions: normaliza type com espaço e maiúscula', () => {
  const raw = '[{"type": " Comprehension ", "question_text": "Vale?"}]';
  const { valid } = parseQuestions(raw);
  assertEquals(valid[0].type, 'comprehension');
});

Deno.test('parseQuestions: descarta question_text vazio ou só espaço', () => {
  const raw = '[{"type":"reflection","question_text":"   "},{"type":"reflection"}]';
  const { valid, rejected } = parseQuestions(raw);
  assertEquals(valid.length, 0);
  assertEquals(rejected.length, 2);
});

Deno.test('parseQuestions: lote inteiro inválido devolve zero válidas', () => {
  // O chamador decide o que fazer com isso — aqui só não mentimos sobre o resultado.
  const { valid, rejected } = parseQuestions('[{"type":"x","question_text":"y"}]');
  assertEquals(valid.length, 0);
  assertEquals(rejected.length, 1);
});

// --- validação da avaliação ---

Deno.test('parseEvaluation: prende o score na faixa 0-100', () => {
  assertEquals(parseEvaluation('{"score": 140, "feedback": "ok"}').score, 100);
  assertEquals(parseEvaluation('{"score": -20, "feedback": "ok"}').score, 0);
});

Deno.test('parseEvaluation: arredonda score fracionário', () => {
  assertEquals(parseEvaluation('{"score": 87.6, "feedback": "ok"}').score, 88);
});

Deno.test('parseEvaluation: recusa score não numérico e feedback vazio', () => {
  assertThrows(() => parseEvaluation('{"score": "alto", "feedback": "ok"}'), Error);
  assertThrows(() => parseEvaluation('{"score": 50, "feedback": "  "}'), Error);
});
