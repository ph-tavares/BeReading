// supabase/functions/retry-pending-quizzes/filter.test.ts
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildPendingFilter } from './filter.ts';
import { NO_CONTENT_ERROR_PREFIX } from '../_shared/content.ts';

const CUTOFF = '2026-09-03T12:00:00.000Z';

/** Separa as cláusulas de topo respeitando parênteses aninhados. */
function topLevelClauses(filtro: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let atual = '';
  for (const ch of filtro) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(atual);
      atual = '';
      continue;
    }
    atual += ch;
  }
  if (atual) out.push(atual);
  return out;
}

Deno.test('buildPendingFilter: inclui capítulos NUNCA tentados (BER-27)', () => {
  // O furo: sem esta cláusula, os 9 capítulos com last_attempt_at=NULL
  // ficavam presos em pending para sempre.
  assertStringIncludes(
    buildPendingFilter(CUTOFF),
    'and(status.eq.pending,last_attempt_at.is.null)',
  );
});

Deno.test('buildPendingFilter: mantém os pendentes travados há mais de 30min', () => {
  assertStringIncludes(
    buildPendingFilter(CUTOFF),
    `and(status.eq.pending,last_attempt_at.lt.${CUTOFF})`,
  );
});

Deno.test('buildPendingFilter: mantém os que falharam explicitamente', () => {
  assertStringIncludes(buildPendingFilter(CUTOFF), 'status.eq.failed');
});

Deno.test('buildPendingFilter: são exatamente três cláusulas de topo', () => {
  assertEquals(topLevelClauses(buildPendingFilter(CUTOFF)).length, 3);
});

// ---------------------------------------------------------------------------
// BER-66 — falta de conteúdo não se resolve com retry
// ---------------------------------------------------------------------------

Deno.test('buildPendingFilter: exclui os que falharam por falta de conteúdo', () => {
  const filtro = buildPendingFilter(CUTOFF);
  assertStringIncludes(filtro, `error_message.not.like.${NO_CONTENT_ERROR_PREFIX}*`);
});

Deno.test('buildPendingFilter: o failed sem error_message continua sendo re-tentado', () => {
  // `not.like` sobre NULL não é verdadeiro — sem o `is.null` explícito, o filtro
  // deixaria de fora todo capítulo que falhou por erro de IA, que é o caso comum.
  const clausulaFailed = topLevelClauses(buildPendingFilter(CUTOFF))
    .find(c => c.includes('status.eq.failed'));
  assert(clausulaFailed, 'a cláusula de failed sumiu do filtro');
  assertStringIncludes(clausulaFailed, 'error_message.is.null');
});

Deno.test('buildPendingFilter: a exclusão de NO_CONTENT vale só para failed', () => {
  // As duas cláusulas de pending não podem carregar a condição de error_message:
  // um capítulo pendente nunca foi marcado como sem conteúdo.
  for (const clausula of topLevelClauses(buildPendingFilter(CUTOFF))) {
    if (clausula.includes('status.eq.pending')) {
      assert(
        !clausula.includes('error_message'),
        `cláusula de pending não deve filtrar por error_message: ${clausula}`,
      );
    }
  }
});
