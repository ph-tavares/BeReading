// supabase/functions/scripts/smoke-claude-code.ts
// BER-59: prova de ambiente. Roda o pipeline com a IA REAL do Claude Code e conta o que aconteceu.
// Não é teste de suíte — depende de subprocesso e da resposta de um modelo, que não é determinística.
// Serve para responder uma pergunta só: *o Claude Code devolve o que os prompts do pipeline esperam?*
//
//   deno run --allow-net --allow-env --allow-run=claude scripts/smoke-claude-code.ts
//
// Em máquina sem navegador, exporte antes `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`).
//
// Etapa 1: o prompt de extração real -> Claude Code -> o parser real do pipeline.
// Etapa 2: o worker inteiro, com rede dublada e IA real, do ISBN ao conhecimento publicado.
import { claudeCodeAI, LOCAL_AI_TIMEOUT_MS } from '../_shared/ai-claude-code.ts';
import type { AIRequest } from '../_shared/ai.ts';
import { buildExtractionPrompt, parseExtraction } from '../_shared/ingestion/extraction.ts';
import { buildLocalContext, fixedSearch } from '../_shared/ingestion/local-context.ts';
import { ALLOW_ALL } from '../_shared/ingestion/robots.ts';
import { AI_STEP_TIMEOUT_MS } from '../_shared/ingestion/steps/context.ts';
import { runWorker } from '../_shared/ingestion/worker.ts';
import { MemoryIngestionStore } from '../_shared/test-support/memoryIngestionStore.ts';

// Textos sintéticos: o repositório é público, nada de obra protegida aqui. Precisam passar de
// MIN_USEFUL_WORDS (150 palavras, policy.ts) e usar vocabulário DIFERENTE um do outro — senão o
// simhash os funde num único grupo de independência e nada se confirma (spec §5.6).
const TEXTO_OBRA = [
  'CAPÍTULO 1 — A chegada',
  'Ana desembarcou na cidade ao amanhecer, com uma mala de couro gasto e o endereço antigo do irmão',
  'anotado num papel dobrado. A estação cheirava a óleo e a pão quente. Fazia sete anos que ninguém',
  'da família tinha notícia dele, desde a carta enviada do porto, na véspera de um embarque que ela',
  'nunca entendeu direito. Ana perguntou ao bilheteiro, perguntou ao homem que varria a plataforma,',
  'perguntou à mulher que vendia bilhetes de loteria junto ao portão. Nenhum deles soube dizer onde',
  'o irmão morava. O papel dobrado indicava uma rua que havia sido demolida dois invernos antes.',
  'Ao meio-dia, sem saber para onde ir, ela sentou-se num banco diante da igreja e contou o dinheiro',
  'que restava. Dava para três dias de pensão, talvez quatro se comesse pouco. Decidiu que ficaria',
  'até encontrá-lo, e que começaria pelo mercado, porque no mercado toda a cidade passa.',
  '',
  'CAPÍTULO 2 — O irmão',
  'No terceiro dia, entre as bancas de frutas, Ana reconheceu o irmão pelo modo de inclinar a cabeça',
  'ao pesar as laranjas. Ele estava mais magro e tinha deixado a barba crescer. Quando a viu, fingiu',
  'não vê-la, e continuou a atender a fila de clientes como se nada tivesse acontecido. Ana esperou',
  'o mercado fechar, encostada num poste, até que ele recolheu os caixotes e veio na direção dela',
  'sem dizer nada. Caminharam juntos até o fim da rua. À noite, sentados numa cozinha emprestada,',
  'os dois conversaram pela primeira vez desde a partida. Ele explicou a dívida, o nome trocado, o',
  'medo de voltar. Ana ouviu tudo sem interromper e só então disse por que tinha vindo.',
].join('\n');

const TEXTO_RESUMO = [
  'Guia de leitura — sumário completo da obra',
  'A obra compõe-se de dois capítulos, a saber: capítulo 1, A chegada; capítulo 2, O irmão. Não há',
  'outras divisões, partes ou apêndices além dos dois capítulos aqui relacionados.',
  'Capítulo 1: A chegada. A narrativa principia com o desembarque da protagonista numa localidade',
  'que jamais visitara. O propósito declarado da viagem consiste em localizar um familiar afastado',
  'do convívio doméstico há quase uma década. As diligências iniciais junto aos funcionários do',
  'terminal ferroviário resultam infrutíferas, porquanto o logradouro registrado no documento que',
  'a personagem transporta deixara de existir em virtude de obras urbanas recentes. O autor',
  'aproveita a sequência para estabelecer a precariedade financeira da protagonista, cujos recursos',
  'comportam permanência breve. Encerra-se a unidade com a deliberação de conduzir as buscas ao',
  'entreposto comercial da localidade, espaço de circulação coletiva.',
  'Capítulo 2: O irmão. A segunda unidade consuma o reencontro anunciado. O reconhecimento ocorre',
  'por intermédio de um gesto habitual, e não da fisionomia, alterada pelo emagrecimento e pela',
  'barba. Registre-se a recusa inicial do familiar em admitir a identificação, prolongada durante',
  'toda a jornada comercial. A conversação efetiva sobrevém apenas ao término do expediente, em',
  'ambiente doméstico cedido por terceiros, ocasião em que se esclarecem os motivos do afastamento:',
  'obrigação pecuniária pendente, substituição de identidade e receio do retorno. A protagonista',
  'reserva para o desfecho a exposição de suas próprias razões.',
].join('\n');

const ai = claudeCodeAI(undefined, { timeoutMs: LOCAL_AI_TIMEOUT_MS });
let chamadas = 0;
const aiContado = (req: AIRequest) => {
  chamadas++;
  return ai(req);
};

async function etapa1(): Promise<boolean> {
  console.log('--- Etapa 1: prompt de extração real -> Claude Code -> parser real ---');
  const prompt = buildExtractionPrompt({
    bookTitle: 'Livro Sintético',
    authors: ['Autora Exemplo'],
    sourceUrl: 'https://exemplo.org/resumo',
    chunkIndex: 0,
    chunkCount: 1,
    previousChapter: null,
  }, TEXTO_OBRA);

  const inicio = Date.now();
  const resposta = await aiContado({ prompt, maxTokens: 4000, timeoutMs: AI_STEP_TIMEOUT_MS });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`modelo: ${resposta.model} | ${segundos}s | ${resposta.text.length} caracteres de resposta`);

  try {
    const extraido = parseExtraction(resposta.text);
    console.log(`estrutura: ${extraido.structure.length} capítulo(s) — ${extraido.structure.map((c) => `${c.number}:${c.title ?? '-'}`).join(', ')}`);
    console.log(`afirmações: ${extraido.claims.length} | descartadas pelo parser: ${extraido.rejected.length}`);
    for (const c of extraido.claims.slice(0, 4)) console.log(`  cap ${c.chapterRef?.number ?? '-'}: ${c.statement.slice(0, 80)}`);
    const ok = extraido.structure.length > 0 && extraido.claims.length > 0;
    console.log(ok ? 'ETAPA 1: OK' : 'ETAPA 1: FALHOU (parser não achou estrutura nem afirmações)');
    return ok;
  } catch (err) {
    console.log(`ETAPA 1: FALHOU ao parsear — ${err instanceof Error ? err.message : String(err)}`);
    console.log(`resposta crua (300 primeiros): ${resposta.text.slice(0, 300)}`);
    return false;
  }
}

async function etapa2(): Promise<boolean> {
  console.log('\n--- Etapa 2: worker completo (rede dublada, IA real) ---');
  const store = new MemoryIngestionStore(() => Date.now());
  store.policies.push({
    domain: 'exemplo.org', policy: 'allowed', weight: 'A', sourceType: 'public_domain_text', authorizesFullText: true, hostCountry: 'US',
  });

  const ctx = buildLocalContext({
    store,
    // Domínios DIFERENTES de propósito: a obra e o guia precisam cair em grupos de independência
    // distintos, senão nenhuma confirmação acontece (spec §11, item 39 — todo texto integral da
    // obra entra num grupo só).
    search: fixedSearch([{ url: 'https://exemplo.org/texto', title: 'Texto' }, { url: 'https://guia-exemplo.net/resumo', title: 'Guia' }]),
    ai: aiContado,
  });
  // Rede dublada: o que se quer medir é a IA, não a internet.
  ctx.fetchEdition = () => Promise.resolve({
    title: 'Livro Sintético', authors: ['Autora Exemplo'], authorDeathYear: 1900, publishers: ['Editora Exemplo'],
    language: 'pt', publishYear: 2001, firstPublishYear: 1890, workKey: '/works/OL1W', originalLanguage: 'pt', tableOfContents: [],
  });
  ctx.fetchGoogle = () => Promise.resolve(null);
  ctx.fetchRobots = () => Promise.resolve(ALLOW_ALL);
  ctx.fetchPage = (url: string) => Promise.resolve({
    finalUrl: url, status: 200, kind: 'html' as const, title: 'Fonte',
    text: url.includes('guia-exemplo') ? TEXTO_RESUMO : TEXTO_OBRA,
    html: null, pdfPages: null, pdfNextPage: null, headers: new Headers(),
  });

  const edition = await store.insertEdition('9780000000001', null);
  const run = await store.createRun(edition.id, {});
  await store.enqueueSteps([{ runId: run.id, kind: 'edition', subject: edition.isbn }]);

  for (let ciclo = 1; ciclo <= 30; ciclo++) {
    const report = await runWorker(ctx);
    const atual = await store.getRun(run.id);
    if (atual.status !== 'queued' && atual.status !== 'running') break;
    if (report.processed === 0 && report.deferred === 0) break;
  }

  const final = await store.getRun(run.id);
  for (const f of await store.listSources(run.id)) {
    console.log(`  fonte ${f.decision}${f.rejectionReason ? `(${f.rejectionReason})` : ''} tipo=${f.sourceType ?? '-'} peso=${f.weight ?? '-'} grupo=${f.independenceGroup ?? '-'} — ${f.url}`);
  }
  for (const p of await store.listSteps(run.id)) {
    console.log(`  passo ${p.kind} "${p.subject.slice(0, 50)}": ${p.status}${p.error ? ` — ${p.error.slice(0, 120)}` : ''}`);
  }
  const capitulos = await store.listEditionChapters(edition.id);
  const conhecimento = capitulos.length === 0 ? [] : await store.listKnowledge(edition.id, capitulos.length);
  console.log(`run: ${final.status}${final.statusReason ? ` (${final.statusReason})` : ''}`);
  console.log(`capítulos confirmados: ${capitulos.length}`);
  for (const k of conhecimento) console.log(`  cap ${k.chapterNumber}: ${k.status} fatos=${k.facts.length} — ${k.facts.map((f) => f.statement.slice(0, 50)).join(' | ')}`);
  console.log(`texto bruto restante: ${store.texts.size} (tem de ser 0)`);

  const ok = capitulos.length > 0 && conhecimento.some((k) => k.facts.length > 0) && store.texts.size === 0;
  console.log(ok ? 'ETAPA 2: OK' : 'ETAPA 2: FALHOU');
  return ok;
}

const ok1 = await etapa1();
const ok2 = await etapa2();
console.log(`\n===== SMOKE ${ok1 && ok2 ? 'OK' : 'FALHOU'} | ${chamadas} chamadas ao Claude Code =====`);
Deno.exit(ok1 && ok2 ? 0 : 1);
