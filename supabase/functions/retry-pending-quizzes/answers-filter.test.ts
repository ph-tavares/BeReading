// supabase/functions/retry-pending-quizzes/answers-filter.test.ts
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  buildStaleEvaluationFilter,
  EVALUATION_BATCH_LIMIT,
  EVALUATION_GIVE_UP_AFTER_MS,
  EVALUATION_STUCK_AFTER_MS,
} from './answers-filter.ts';

const CUTOFF = '2026-09-04T12:00:00.000Z';

Deno.test('buildStaleEvaluationFilter: pega as que falharam na avaliação', () => {
  assertStringIncludes(buildStaleEvaluationFilter(CUTOFF), 'evaluation_status.eq.failed');
});

Deno.test('buildStaleEvaluationFilter: pega as presas em pending há tempo demais', () => {
  assertStringIncludes(
    buildStaleEvaluationFilter(CUTOFF),
    `and(evaluation_status.eq.pending,answered_at.lt.${CUTOFF})`,
  );
});

Deno.test('buildStaleEvaluationFilter: NÃO pega avaliação recém-criada', () => {
  // Uma resposta que acabou de chegar está em pending por milissegundos — o cron
  // não pode atropelar a avaliação que ainda está rodando e gastar IA em dobro.
  const filtro = buildStaleEvaluationFilter(CUTOFF);
  assert(
    !filtro.includes('evaluation_status.eq.pending,answered_at.gt'),
    'pending sem recorte de tempo faria o cron competir com a avaliação em curso',
  );
  assertStringIncludes(filtro, 'answered_at.lt.');
});

Deno.test('buildStaleEvaluationFilter: nunca inclui as já concluídas', () => {
  assert(!buildStaleEvaluationFilter(CUTOFF).includes('completed'));
});

Deno.test('buildStaleEvaluationFilter: duas cláusulas de topo', () => {
  const topo = buildStaleEvaluationFilter(CUTOFF).split(/,(?![^(]*\))/);
  assertEquals(topo.length, 2);
});

Deno.test('janela de retry é menor que a de desistência', () => {
  // Se o "travado" fosse maior que o "desistir", nenhuma resposta seria elegível.
  assert(
    EVALUATION_STUCK_AFTER_MS < EVALUATION_GIVE_UP_AFTER_MS,
    'a janela de retry precisa caber dentro da janela de desistência',
  );
});

Deno.test('o teto por execução é conservador', () => {
  // Cada item custa uma chamada de IA. Sem teto, uma falha ampla do provedor
  // viraria uma conta grande na primeira execução seguinte.
  assert(EVALUATION_BATCH_LIMIT > 0 && EVALUATION_BATCH_LIMIT <= 50);
});
