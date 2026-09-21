// supabase/functions/scripts/ingest-local.ts
// BER-59: roda a ingestão de um livro NA MÁQUINA DO DESENVOLVEDOR, com a IA saindo pelo Claude
// Code CLI. Substitui, no desenvolvimento, o par `ingest-book` + `process-ingestion` + pg_cron.
//
// Nada aqui é importado por código de produção: é um script de linha de comando.
//
//   deno run --allow-net --allow-env --allow-read --allow-run=claude \
//     scripts/ingest-local.ts --isbn=9788535914849 --sources=./fontes.json
//
// Ver `docs/ingestao-local.md`.
import { claudeCodeAI, LOCAL_AI_TIMEOUT_MS } from '../_shared/ai-claude-code.ts';
import { buildLocalContext, fixedSearch } from '../_shared/ingestion/local-context.ts';
import { tavilySearch } from '../_shared/ingestion/sources/tavily.ts';
import type { IngestionStore, RunRow } from '../_shared/ingestion/store.ts';
import { SupabaseIngestionStore } from '../_shared/ingestion/supabase-store.ts';
import { runWorker } from '../_shared/ingestion/worker.ts';
import { isValidIsbnFormat, normalizeIsbn } from '../_shared/openlibrary.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { MemoryIngestionStore } from '../_shared/test-support/memoryIngestionStore.ts';

export interface LocalRunOptions {
  isbn: string;
  store: 'memory' | 'supabase';
  /** JSON com `[{ "url": "...", "title": "..." }]`, usado quando não há `TAVILY_API_KEY`. */
  sourcesFile: string | null;
  bookId: string | null;
  maxCycles: number;
}

const USO = [
  'uso: deno run --allow-net --allow-env --allow-read --allow-run=claude scripts/ingest-local.ts \\',
  '       --isbn=<isbn> [--store=memory|supabase] [--sources=<arquivo.json>] [--book-id=<uuid>] [--max-cycles=<n>]',
].join('\n');

/** Lógica pura, separada do script para ser testável (AGENTS.md §4). */
export function parseArgs(argv: string[]): LocalRunOptions {
  const valor = (nome: string): string | null => {
    const prefixo = `--${nome}=`;
    const achado = argv.find((a) => a.startsWith(prefixo));
    return achado === undefined ? null : achado.slice(prefixo.length);
  };

  const isbn = normalizeIsbn(valor('isbn') ?? '');
  if (!isValidIsbnFormat(isbn)) throw new Error(`--isbn ausente ou inválido.\n${USO}`);

  const store = valor('store') ?? 'memory';
  if (store !== 'memory' && store !== 'supabase') throw new Error(`--store aceita memory ou supabase.\n${USO}`);

  const maxCycles = Number(valor('max-cycles') ?? '100');
  if (!Number.isInteger(maxCycles) || maxCycles < 1) throw new Error(`--max-cycles precisa ser inteiro >= 1.\n${USO}`);

  return { isbn, store, sourcesFile: valor('sources'), bookId: valor('book-id'), maxCycles };
}

/**
 * Retoma o run em andamento da edição em vez de abrir outro (achado do crítico cross-model,
 * 20/09/2026). Um passo devolvido à fila por erro transitório — credencial vencida, timeout — fica
 * `pending` com hora marcada; sem esta checagem, a execução seguinte abriria um run novo, perdendo
 * o progresso no store em memória e deixando dois runs disputando a mesma edição no Supabase. É a
 * mesma regra do `ingest-book` (BER-59 M1), que devolve 409 com o run existente.
 */
export async function resumeOrCreateRun(
  store: IngestionStore,
  editionId: string,
  isbn: string,
): Promise<{ run: RunRow; resumed: boolean }> {
  const ativo = await store.findActiveRun(editionId);
  if (ativo !== null) return { run: ativo, resumed: true };

  const run = await store.createRun(editionId, {});
  await store.enqueueSteps([{ runId: run.id, kind: 'edition', subject: isbn }]);
  return { run, resumed: false };
}

function buildStore(tipo: LocalRunOptions['store']): IngestionStore {
  // O store em memória não persiste entre execuções: serve para exercitar o pipeline inteiro sem
  // depender do `supabase start` (a porta 54321 pode estar ocupada por outro projeto).
  return tipo === 'memory' ? new MemoryIngestionStore(() => Date.now()) : new SupabaseIngestionStore(createServiceClient());
}

async function buildSearch(options: LocalRunOptions) {
  const chave = Deno.env.get('TAVILY_API_KEY');
  if (chave) {
    console.log('descoberta: Tavily (mesmo caminho de produção)');
    return (consulta: string) => tavilySearch(consulta, chave);
  }
  if (options.sourcesFile === null) {
    throw new Error('sem TAVILY_API_KEY: passe --sources=<arquivo.json> com a lista de URLs a usar.');
  }
  const lista = JSON.parse(await Deno.readTextFile(options.sourcesFile)) as { url: string; title?: string }[];
  console.log(`descoberta: lista fixa de ${lista.length} URL(s) (sem Tavily)`);
  return fixedSearch(lista);
}

async function relatorio(store: IngestionStore, runId: string, editionId: string): Promise<void> {
  const run = await store.getRun(runId);
  const passos = await store.listSteps(runId);
  const fontes = await store.listSources(runId);
  const capitulos = await store.listEditionChapters(editionId);
  const conhecimento = capitulos.length === 0 ? [] : await store.listKnowledge(editionId, capitulos.length);

  let textosRestantes = 0;
  for (const fonte of fontes) {
    if (await store.getSourceText(fonte.id) !== null) textosRestantes++;
  }

  const porStatus = (lista: { status: string }[]) =>
    Object.entries(lista.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {}))
      .map(([k, v]) => `${k}=${v}`).join(' ');

  console.log('\n===== RESULTADO DO RUN =====');
  console.log(`run:        ${run.id}`);
  console.log(`status:     ${run.status}${run.statusReason ? ` (${run.statusReason})` : ''}`);
  console.log(`stats:      ${JSON.stringify(run.stats)}`);
  console.log(`passos:     ${porStatus(passos)}`);
  console.log(`fontes:     ${porStatus(fontes.map((f) => ({ status: f.decision })))}`);
  for (const f of fontes.filter((f) => f.decision === 'rejected')) {
    console.log(`  rejeitada: ${f.rejectionReason ?? 'sem motivo'} — ${f.url.slice(0, 90)}`);
  }
  console.log(`capítulos:  ${capitulos.length}`);
  for (const k of conhecimento) {
    console.log(`  cap ${String(k.chapterNumber).padStart(2)}: ${k.status} conf=${k.confidence} fatos=${k.facts.length}`);
  }
  console.log(`texto bruto restante: ${textosRestantes} (tem de ser 0 — a obra não pode ficar guardada)`);
  const passosAbertos = passos.filter((p) => p.status === 'pending' || p.status === 'running');
  for (const p of passosAbertos) {
    console.log(`  pendente: ${p.kind} ${p.subject.slice(0, 60)} tentativas=${p.attempts} próxima=${p.nextAttemptAt ?? '-'} erro=${p.error ?? '-'}`);
  }
  console.log('\nATENÇÃO: o modelo aqui é o do Claude Code, não o `claude-haiku-4-5` de produção.');
  console.log('Isto prova o encanamento do pipeline, NÃO a qualidade do conteúdo.');
}

async function main(): Promise<void> {
  const options = parseArgs(Deno.args);
  const store = buildStore(options.store);
  const search = await buildSearch(options);
  const ctx = buildLocalContext({ store, search, ai: claudeCodeAI(undefined, { timeoutMs: LOCAL_AI_TIMEOUT_MS }) });

  let edition = await store.findEditionByIsbn(options.isbn);
  if (!edition) edition = await store.insertEdition(options.isbn, options.bookId);
  const { run, resumed } = await resumeOrCreateRun(store, edition.id, options.isbn);
  console.log(`run ${run.id} ${resumed ? 'RETOMADO' : 'criado'} para o ISBN ${options.isbn} (store: ${options.store})`);

  for (let ciclo = 1; ciclo <= options.maxCycles; ciclo++) {
    const report = await runWorker(ctx);
    const atual = await store.getRun(run.id);
    console.log(`ciclo ${ciclo}: processados=${report.processed} falhos=${report.failed} adiados=${report.deferred} run=${atual.status}`);
    if (atual.status !== 'queued' && atual.status !== 'running') break;
    if (report.processed === 0 && report.deferred === 0) {
      console.log('nenhum passo pronto agora: há retentativa marcada para daqui a pouco.');
      console.log('rode o mesmo comando de novo depois desse horário — o run é retomado, não recriado.');
      break;
    }
  }

  await relatorio(store, run.id, edition.id);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    Deno.exit(1);
  });
}
