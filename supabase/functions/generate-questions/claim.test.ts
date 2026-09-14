// supabase/functions/generate-questions/claim.test.ts
// Testa o módulo REAL (import de ./claim.ts), não uma cópia — ver BER-35.
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildClaimableFilter, CLAIM_TTL_MS, isClaimable } from './claim.ts';

const NOW = Date.parse('2026-09-10T19:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

Deno.test('isClaimable: capítulo nunca tentado pode ser reivindicado', () => {
  assertEquals(isClaimable({ status: 'pending', last_attempt_at: null }, NOW), true);
});

Deno.test('isClaimable: tentativa mais velha que o TTL pode ser reivindicada', () => {
  assertEquals(
    isClaimable({ status: 'pending', last_attempt_at: ago(CLAIM_TTL_MS + 1000) }, NOW),
    true,
  );
});

Deno.test('isClaimable: tentativa recente NÃO pode — é a corrida da BER-41', () => {
  // Dois leitores terminam o capítulo juntos: o segundo chega enquanto o primeiro
  // espera a IA. Sem esta regra, os dois geram e o quiz fica com 8 perguntas.
  assertEquals(isClaimable({ status: 'pending', last_attempt_at: ago(5_000) }, NOW), false);
});

Deno.test('isClaimable: generated nunca é reivindicado, por mais velho que seja', () => {
  assertEquals(
    isClaimable({ status: 'generated', last_attempt_at: ago(CLAIM_TTL_MS * 10) }, NOW),
    false,
  );
});

Deno.test('isClaimable: failed antigo volta a ser reivindicável (é o que o retry faz)', () => {
  assertEquals(
    isClaimable({ status: 'failed', last_attempt_at: ago(CLAIM_TTL_MS + 1000) }, NOW),
    true,
  );
});

Deno.test('buildClaimableFilter: nunca tentado OU mais velho que o TTL', () => {
  assertEquals(
    buildClaimableFilter(NOW),
    `last_attempt_at.is.null,last_attempt_at.lt.${ago(CLAIM_TTL_MS)}`,
  );
});

Deno.test('CLAIM_TTL_MS: maior que uma geração normal, menor que o "travado" do retry', () => {
  // A geração leva ~5 s; o retry considera um pending travado depois de 30 min.
  // Um TTL fora dessa faixa ou deixa a corrida passar, ou impede o retry.
  assert(CLAIM_TTL_MS >= 60_000);
  assert(CLAIM_TTL_MS < 30 * 60 * 1000);
});
