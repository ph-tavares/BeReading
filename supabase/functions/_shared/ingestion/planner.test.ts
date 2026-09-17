import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { planNextSteps, type RunView, type StepView } from './planner.ts';

const run: RunView = { status: 'running', payload: {} };
const st = (kind: StepView['kind'], status: StepView['status'], subject = '-'): StepView => ({ kind, subject, status });

Deno.test('estrutura só começa quando edição, descoberta, download e extração terminaram', () => {
  assertEquals(planNextSteps(run, [st('edition', 'done'), st('fetch', 'running', 'https://a')], []), []);
  assertEquals(
    planNextSteps(run, [st('edition', 'done'), st('discover', 'done', 'q'), st('fetch', 'failed', 'https://a'), st('extract', 'done', 's#0')], []),
    [{ kind: 'structure', subject: '-' }],
  );
});

Deno.test('verificação começa depois da estrutura e da descoberta por capítulo, uma por capítulo', () => {
  const steps = [st('edition', 'done'), st('structure', 'done'), st('discover', 'pending', 'cap:2')];
  assertEquals(planNextSteps(run, steps, [1, 2]), []);
  steps[2] = st('discover', 'done', 'cap:2');
  assertEquals(planNextSteps(run, steps, [1, 2]), [
    { kind: 'verify', subject: '1' },
    { kind: 'verify', subject: '2' },
  ]);
});

Deno.test('estrutura que não confirmou nada (ou falhou) vai direto ao publish', () => {
  assertEquals(planNextSteps(run, [st('edition', 'done'), st('structure', 'failed')], []), [{ kind: 'publish', subject: '-' }]);
});

Deno.test('publish depois que todas as verificações terminaram, uma vez só', () => {
  const steps = [st('edition', 'done'), st('structure', 'done'), st('verify', 'done', '1'), st('verify', 'running', '2')];
  assertEquals(planNextSteps(run, steps, [1, 2]), []);
  steps[3] = st('verify', 'failed', '2');
  assertEquals(planNextSteps(run, steps, [1, 2]), [{ kind: 'publish', subject: '-' }]);
  assertEquals(planNextSteps(run, [...steps, st('publish', 'pending')], [1, 2]), []);
});

Deno.test('edição que falhou fecha o run pelo publish', () => {
  assertEquals(planNextSteps(run, [st('edition', 'failed')], []), [{ kind: 'publish', subject: '-' }]);
});

Deno.test('rebusca: verifica só os capítulos pedidos, sem edição nem estrutura', () => {
  const recheck: RunView = { status: 'running', payload: { recheckChapters: [3] } };
  assertEquals(planNextSteps(recheck, [st('discover', 'running', 'cap:3')], [1, 2, 3]), []);
  assertEquals(planNextSteps(recheck, [st('discover', 'done', 'cap:3')], [1, 2, 3]), [{ kind: 'verify', subject: '3' }]);
});

Deno.test('run encerrado não planeja nada', () => {
  assertEquals(planNextSteps({ status: 'partial', payload: {} }, [st('edition', 'done')], []), []);
});

Deno.test('estrutura sem confirmação que buscou por capítulo tenta de novo, uma vez, depois da coleta (spec §11, item 25)', () => {
  const primeira = { ...st('structure', 'done'), payload: { nova_tentativa: true } };
  assertEquals(planNextSteps(run, [st('edition', 'done'), primeira, st('fetch', 'pending', 'https://a')], []), []);
  assertEquals(planNextSteps(run, [st('edition', 'done'), primeira, st('fetch', 'done', 'https://a')], []), [{ kind: 'structure', subject: '2' }]);
  assertEquals(planNextSteps(run, [st('edition', 'done'), primeira, st('structure', 'running', '2')], []), []);
  assertEquals(planNextSteps(run, [st('edition', 'done'), primeira, st('structure', 'done', '2')], []), [{ kind: 'publish', subject: '-' }]);
});
