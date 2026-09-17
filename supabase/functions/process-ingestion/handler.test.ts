import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { fakeContext, NOW } from '../_shared/test-support/ingestionContext.ts';
import { MemoryIngestionStore } from '../_shared/test-support/memoryIngestionStore.ts';
import { handler } from './index.ts';

const env = (extra: Record<string, string> = {}) => (name: string): string | undefined =>
  ({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_teste' }), CRON_SECRET: 'cron-teste', ...extra } as Record<string, string>)[name];

const request = (headers: Record<string, string>) => new Request('http://localhost/process-ingestion', { method: 'POST', headers, body: '{}' });

Deno.test('process-ingestion: sem credencial devolve 401', async () => {
  const res = await handler(request({}), { context: () => fakeContext(new MemoryIngestionStore(() => NOW)), getEnv: env() });
  assertEquals(res.status, 401);
});

Deno.test('process-ingestion: aceita o CRON_SECRET do pg_cron e devolve o relatório', async () => {
  const res = await handler(request({ Authorization: 'Bearer cron-teste' }), { context: () => fakeContext(new MemoryIngestionStore(() => NOW)), getEnv: env() });
  assertEquals([res.status, (await res.json()).data], [200, { processed: 0, failed: 0, deferred: 0, rechecks: 0 }]);
});

Deno.test('process-ingestion: INGESTION_ENABLED=false não executa nada', async () => {
  let built = false;
  const res = await handler(request({ apikey: 'sb_secret_teste' }), {
    context: () => {
      built = true;
      return fakeContext(new MemoryIngestionStore(() => NOW));
    },
    getEnv: env({ INGESTION_ENABLED: 'false' }),
  });
  assertEquals([res.status, (await res.json()).data, built], [200, { skipped: 'INGESTION_ENABLED=false' }, false]);
});

Deno.test('process-ingestion: kill switch aceita "0"/"off"/"no" e variação de caixa/espaço (BER-59 M3)', async () => {
  for (const valor of ['0', 'off', 'NO', ' False ']) {
    let built = false;
    const res = await handler(request({ apikey: 'sb_secret_teste' }), {
      context: () => {
        built = true;
        return fakeContext(new MemoryIngestionStore(() => NOW));
      },
      getEnv: env({ INGESTION_ENABLED: valor }),
    });
    assertEquals([res.status, built], [200, false], `valor "${valor}" devia desligar a ingestão`);
  }
});
