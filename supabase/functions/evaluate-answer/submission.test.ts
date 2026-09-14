// supabase/functions/evaluate-answer/submission.test.ts
// Testa o módulo REAL (import de ./submission.ts), não uma cópia — ver BER-35.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { existingAnswerResult, isUniqueViolation, PENDING_FEEDBACK } from './submission.ts';

Deno.test('isUniqueViolation: reconhece o 23505 do Postgres', () => {
  assertEquals(isUniqueViolation({ code: '23505' }), true);
});

Deno.test('isUniqueViolation: qualquer outro erro não é resposta repetida', () => {
  assertEquals(isUniqueViolation({ code: '23503' }), false);
  assertEquals(isUniqueViolation({}), false);
  assertEquals(isUniqueViolation(null), false);
});

Deno.test('existingAnswerResult: resposta avaliada devolve a nota e o feedback que já existem', () => {
  assertEquals(
    existingAnswerResult({
      evaluation_status: 'completed',
      comprehension_score: 82,
      ai_feedback: 'Boa leitura do capítulo.',
    }),
    { score: 82, feedback: 'Boa leitura do capítulo.' },
  );
});

Deno.test('existingAnswerResult: resposta ainda sem nota não vira zero (BER-42)', () => {
  assertEquals(
    existingAnswerResult({ evaluation_status: 'pending', comprehension_score: null, ai_feedback: null }),
    { score: null, feedback: PENDING_FEEDBACK },
  );
  assertEquals(
    existingAnswerResult({ evaluation_status: 'failed', comprehension_score: null, ai_feedback: null }),
    { score: null, feedback: PENDING_FEEDBACK },
  );
});

Deno.test('PENDING_FEEDBACK: o texto que o app já mostra não muda', () => {
  assertEquals(PENDING_FEEDBACK, 'Resposta recebida! A avaliação ficará disponível em breve.');
});
