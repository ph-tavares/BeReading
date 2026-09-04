// supabase/functions/_shared/background.ts
// Disparo de trabalho em segundo plano numa Edge Function.
//
// `fetch(...).catch(() => {})` sem await NÃO garante que o request saia: o worker
// pode ser encerrado assim que a resposta é devolvida, e a tarefa morre sem deixar
// rastro. Foi o que travou o loop do quiz (BER-27) — `attempts=0` prova que
// `generate-questions` nunca chegou a rodar.
//
// `EdgeRuntime.waitUntil` mantém o worker vivo até a promise resolver.

export interface BackgroundRuntime {
  waitUntil: (promise: Promise<unknown>) => void;
}

/** O `EdgeRuntime` global do Supabase, quando existir. */
export function getEdgeRuntime(): BackgroundRuntime | undefined {
  const runtime = (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
  if (
    runtime && typeof (runtime as BackgroundRuntime).waitUntil === 'function'
  ) {
    return runtime as BackgroundRuntime;
  }
  return undefined;
}

/**
 * Registra uma tarefa de segundo plano.
 *
 * Erros são engolidos de propósito (o caller já respondeu ao usuário), mas passam
 * pelo console — silêncio total foi parte do BER-27 durar três meses sem ninguém ver.
 *
 * @returns a promise registrada, para o teste conseguir aguardá-la.
 */
export function dispatchBackground(
  label: string,
  task: () => Promise<unknown>,
  runtime: BackgroundRuntime | undefined = getEdgeRuntime(),
): Promise<unknown> {
  const promise = task().catch((err) => {
    console.error(`[background:${label}] failed:`, err);
  });

  if (runtime) {
    runtime.waitUntil(promise);
  } else {
    // Sem EdgeRuntime (dev local, teste): nada a manter vivo, mas o log fica.
    console.warn(`[background:${label}] EdgeRuntime.waitUntil indisponível`);
  }

  return promise;
}
