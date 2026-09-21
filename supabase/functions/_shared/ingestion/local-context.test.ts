// supabase/functions/_shared/ingestion/local-context.test.ts
// BER-59: garante que o contexto local não repete os limites que só existem na Edge Function e que
// a descoberta sem Tavily se comporta. Nenhum teste aqui toca rede ou subprocesso.
import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { MemoryIngestionStore } from '../test-support/memoryIngestionStore.ts';
import { buildLocalContext, fixedSearch } from './local-context.ts';
import { PermanentStepError } from './queue.ts';

const semBusca = () => Promise.reject(new Error('não usado neste teste'));

Deno.test('buildLocalContext: cpuMs é null, senão o worker local pararia por um teto que não existe fora do Edge Runtime', () => {
  const ctx = buildLocalContext({ store: new MemoryIngestionStore(() => 0), search: semBusca });

  assertEquals(ctx.cpuMs(), null);
});

Deno.test('buildLocalContext: usa a IA injetada quando o teste passa uma, sem subir o Claude Code', async () => {
  const ctx = buildLocalContext({
    store: new MemoryIngestionStore(() => 0),
    search: semBusca,
    ai: () => Promise.resolve({ text: 'resposta', model: 'dublê', usage: { inputTokens: 0, outputTokens: 0 } }),
  });

  const resultado = await ctx.ai({ prompt: 'oi', maxTokens: 10 });

  assertEquals(resultado.text, 'resposta');
});

Deno.test('buildLocalContext: aviso da operação vai para o log injetado, não para o webhook', async () => {
  const linhas: string[] = [];
  const ctx = buildLocalContext({ store: new MemoryIngestionStore(() => 0), search: semBusca, log: (l) => linhas.push(l) });

  await ctx.notify('ingestion', 'algo aconteceu');

  assertEquals(linhas, ['[aviso:ingestion] algo aconteceu']);
});

Deno.test('fixedSearch: devolve as URLs dadas, sem gastar crédito de busca', async () => {
  const busca = fixedSearch([{ url: 'https://exemplo.org/a', title: 'A' }, { url: 'https://exemplo.org/b' }]);

  const resposta = await busca('qualquer consulta');

  assertEquals(resposta.credits, 0);
  assertEquals(resposta.results.map((r) => r.url), ['https://exemplo.org/a', 'https://exemplo.org/b']);
  assertEquals(resposta.results[1].title, '');
});

Deno.test('fixedSearch: lista vazia falha como permanente, em vez de fingir que a busca não achou nada', async () => {
  const busca = fixedSearch([]);

  const err = await assertRejects(() => busca('qualquer consulta'));

  assert(err instanceof PermanentStepError);
});
