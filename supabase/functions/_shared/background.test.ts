// supabase/functions/_shared/background.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { type BackgroundRuntime, dispatchBackground } from './background.ts';

/** Runtime falso que guarda o que foi registrado. */
function fakeRuntime() {
  const registered: Promise<unknown>[] = [];
  const runtime: BackgroundRuntime = {
    waitUntil: (p) => {
      registered.push(p);
    },
  };
  return { runtime, registered };
}

Deno.test('dispatchBackground: registra a tarefa no waitUntil (BER-27)', async () => {
  const { runtime, registered } = fakeRuntime();
  let executou = false;

  const promise = dispatchBackground('generate-questions', async () => {
    executou = true;
  }, runtime);

  // A tarefa tem que estar registrada, senão o worker pode morrer antes dela.
  assertEquals(registered.length, 1);
  await promise;
  assertEquals(executou, true);
});

Deno.test('dispatchBackground: tarefa que falha não derruba o handler', async () => {
  const { runtime, registered } = fakeRuntime();

  const promise = dispatchBackground('award-badges', () => {
    return Promise.reject(new Error('boom'));
  }, runtime);

  assertEquals(registered.length, 1);
  await promise; // não relança — o usuário já recebeu a resposta
});

Deno.test('dispatchBackground: sem EdgeRuntime, ainda executa a tarefa', async () => {
  let executou = false;
  await dispatchBackground('sem-runtime', async () => {
    executou = true;
  }, undefined);
  assertEquals(executou, true);
});
