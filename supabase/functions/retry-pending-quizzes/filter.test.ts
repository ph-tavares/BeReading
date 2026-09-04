// supabase/functions/retry-pending-quizzes/filter.test.ts
import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildPendingFilter } from './filter.ts';

const CUTOFF = '2026-09-03T12:00:00.000Z';

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
  // Vírgula dentro de and(...) não separa cláusula de topo; conferimos pelo
  // número de grupos que o PostgREST vai enxergar.
  const filtro = buildPendingFilter(CUTOFF);
  const topLevel = filtro.split(/,(?![^(]*\))/);
  assertEquals(topLevel.length, 3);
});
