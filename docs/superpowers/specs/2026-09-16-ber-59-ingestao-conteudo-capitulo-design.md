# Ingestão de conteúdo de capítulo por ISBN: design

- **Branch:** `docs/ber-59-spec-ingestao-conteudo-capitulo` (base `1541d88`)
- **Issue:** [BER-59](https://linear.app/tpgn/issue/BER-59) · relacionadas: BER-60 (cadastro fora do catálogo), BER-66 (capítulo sem conteúdo), BER-72 (edição por ISBN), BER-83 (backup), BER-61 (custo)
- **Data:** 2026-09-16 · **Status:** aprovado no brainstorming, seção por seção; aguarda revisão desta spec

## 1. Objetivo

Dado o ISBN de um livro, montar **conhecimento verificado de cada capítulo** a partir de fontes
legais da internet e de bases externas, para que quiz, conversa e, depois, personalização tenham
lastro real em vez de memória do modelo.

**Por que buscar, e não confiar no modelo:** o teste de 16/09 (comentário na BER-59) mostrou que nem
o melhor caso passa. Claude Opus 5, de memória, sobre 8 capítulos sorteados de *Dom Casmurro*:
títulos 8/8, conteúdo 4 certos, 1 parcial, 2 errados (1 invenção específica), 1 abstenção. O modelo
de produção é o Haiku 4.5, que lembra menos.

### Escopo deste ciclo

1. **Edição e estrutura:** ISBN → edição → lista confirmada de capítulos daquela edição.
2. **Descoberta e obtenção:** busca de fontes, política de fonte aplicada antes de ler.
3. **Verificação:** extração de afirmações por fonte, confirmação cruzada, publicação do
   conhecimento por capítulo.

Entrega: um run por ISBN, disparado por endpoint interno, que termina com a base de conhecimento
dos capítulos preenchida e auditável.

### Fora de escopo (próximos ciclos)

- `generate-questions` e `evaluate-answer` lerem a base nova no lugar de `book_contents`.
- Cadastro de livro pelo leitor (BER-60) disparando a ingestão.
- **Reconciliação dos 3 livros do piloto** (§9): trocar a estrutura de capítulos que o app usa e
  migrar progresso, sessões, perguntas e respostas.
- **Personalização por leitor:** perguntas geradas a partir do perfil de leitura. Este ciclo só
  garante que a base sai estruturada o bastante para sustentá-la (fatos, personagens, relações,
  temas por capítulo).
- Reaproveitar conhecimento entre edições da mesma obra (`work_key` é gravado, não usado).

## 2. Decisões tomadas no brainstorming

| # | Decisão | Descartado |
|---|---|---|
| D1 | Pipeline orquestrado pelo nosso código; a IA só extrai e agrupa | Agente de pesquisa com `web_search`/`web_fetch` da Anthropic: menos controle do que é lido, verificação por julgamento do modelo, custo imprevisível |
| D2 | Descoberta pelo **Tavily** (1.000 créditos grátis/mês), atrás de interface trocável | Busca da Anthropic (US$ 10 por 1.000 buscas + tokens); Brave (sem plano gratuito desde 2026) |
| D3 | Livro inteiro ingerido de uma vez, em segundo plano | Capítulo a capítulo sob demanda: espera no fechamento e a mesma página buscada várias vezes |
| D4 | Baixa confiança: usa só o que foi confirmado; nada confirmado = falha honesta + nova busca depois | Falhar o capítulo inteiro; gerar com aviso ao leitor |
| D5 | Todas as categorias de fonte: domínio público, bases abertas, editora, web pública | — |
| D6 | Execução não altera `books` nem `chapters`; edição tem tabela própria | Colunas novas em `books`: criar edição apareceria no catálogo do app |

## 3. Arquitetura e fluxo

```
ingest-book (interno) ──cria──▶ ingestion_runs + primeiro passo em ingestion_steps
                                         │
pg_cron (a cada minuto) ──▶ process-ingestion ──reivindica N passos──▶ executa ──▶ enfileira os próximos
```

- **`ingest-book`**: Edge Function interna (`assertInternalCaller`, como `generate-questions`).
  Corpo: `{ isbn, book_id? }`. `book_id` só liga a edição a um livro existente; nada é escrito em
  `books` ou `chapters`.
- **`process-ingestion`**: chamada pelo `pg_cron` a cada minuto via `pg_net` (mesmo padrão do
  `retry-pending-quizzes`, com a chave lida do Vault, BER-84). Reivindica passos com
  `FOR UPDATE SKIP LOCKED`. Cada passo é curto (< 60 s), idempotente e com retry.
- `pg_cron` e `pg_net` já estão instalados em produção; nenhuma extensão nova.

### Passos de um run

| Passo | Sujeito | O que faz |
|---|---|---|
| `edition` | ISBN | Open Library (`/isbn/{isbn}.json` e a obra) e Google Books: título, autores, editora, idioma, ano, `work_key`, ano de morte do autor quando disponível |
| `discover` | consulta | Tavily: buscas do livro (título + autor + edição, no idioma da edição, em português e no idioma original) e, onde a cobertura ficar baixa, por capítulo. Gera candidatos de URL |
| `fetch` | URL | Política de fonte (§5) → download → extração de texto → `ingestion_source_texts` |
| `extract` | fonte | Haiku extrai estrutura de capítulos que a fonte declara e afirmações por capítulo (§6.1); apaga o texto bruto |
| `structure` | edição | Confirma a estrutura de capítulos (§6.3) e grava `edition_chapters` |
| `verify` | capítulo | Agrupa afirmações, aplica as regras de confirmação (§6.2), grava fatos |
| `publish` | edição | Grava `chapter_knowledge`, compara com `chapters` do livro ligado e fecha o run |

`structure` espera todos os `extract`; `verify` espera `structure`; `publish` espera todos os
`verify`. A dependência vive na lógica de enfileiramento, não em trava.

## 4. Dados

Migration nova. Todas as tabelas com **RLS ligado e nenhuma policy**: só a service key lê e escreve.

### `book_editions`
`id`, `isbn` (unique), `title`, `authors text[]`, `publisher`, `language`, `publish_year`,
`work_key`, `original_language`, `author_death_year`, `book_id` (nullable, FK `books`),
`created_at`.

### `edition_chapters`
Estrutura confirmada da edição. `id`, `edition_id`, `number` (sequencial no livro, 1..N),
`part_label` (ex.: "Parte 2", nullable), `number_in_part` (nullable), `title` (nullable),
`confidence`, `created_at`. Unique `(edition_id, number)`.

Numeração sequencial resolve livros divididos em partes: em *1984*, "Parte 2, Capítulo 3" é o
capítulo 11.

### `ingestion_runs`
`id`, `edition_id`, `status` (`queued` | `running` | `succeeded` | `partial` | `failed`),
`status_reason`, `stats jsonb` (buscas, créditos Tavily, fontes encontradas/aceitas/rejeitadas por
motivo, PDFs rejeitados, tokens de entrada/saída, custo estimado em US$, duração),
`structure_divergence jsonb` (diferença entre `edition_chapters` e `chapters` do livro ligado),
`started_at`, `finished_at`.

### `ingestion_steps`
`id`, `run_id`, `kind`, `subject` (texto: URL, consulta, número de capítulo ou `-`), `status`
(`pending` | `running` | `done` | `failed`), `attempts`, `next_attempt_at`, `locked_at`,
`error`, `payload jsonb`, `created_at`. Unique `(run_id, kind, subject)`.

### `source_domain_policies`
Mantida pelo time. `domain` (PK, domínio registrável), `policy` (`allowed` | `blocked`),
`weight` (`A` | `B` | `C` | `D`, para `allowed`), `reason`, `updated_at`. Seed inicial com
repositórios de domínio público, bases bibliográficas e enciclopédias (`allowed`) e bibliotecas
piratas conhecidas (`blocked`).

### `ingestion_sources`
Uma linha por URL considerada, **sem texto**. `id`, `run_id`, `url`, `final_url`,
`registrable_domain`, `title`, `source_type` (`public_domain_text` | `open_license_text` |
`bibliographic` | `publisher` | `encyclopedia` | `editorial` | `web`), `weight`, `decision`
(`accepted` | `rejected`), `rejection_reason`, `public_domain_basis` (país e regra, nullable),
`content_fingerprint` (simhash), `independence_group`, `fetched_at`.

### `ingestion_source_texts`
**Temporária.** `source_id` (PK), `text`, `created_at`. Apagada no fim do `extract` da fonte; o que
sobrar de run abortado é apagado pelo worker após 24 h. **Excluída do backup** (`-x` no
`backup.yml`).

### `ingestion_claims`
`id`, `run_id`, `source_id`, `chapter_ref jsonb` (como a fonte nomeia: número, parte, título),
`edition_chapter_id` (nullable até a localização), `kind` (`event` | `character` |
`relationship` | `argument` | `theme`), `statement` (≤ 240 caracteres, redigido pelo modelo),
`is_interpretation`, `forward_reference` (bool), `located` (bool).

### `chapter_knowledge`
`id`, `edition_chapter_id` (unique), `run_id`, `status` (`confirmed` | `partial` |
`insufficient`), `confidence`, `summary` (interno, só de fatos confirmados do capítulo),
`recheck_count`, `next_recheck_at`, `published_at`.

### `chapter_facts` e `chapter_fact_sources`
`chapter_facts`: `id`, `chapter_knowledge_id`, `kind`, `statement`, `is_interpretation`,
`confidence`, `independent_support` (int). `chapter_fact_sources`: `fact_id`, `source_id`.

### Regras de dados

- **Nenhum texto literal de obra fica gravado.** Só `ingestion_source_texts` tem texto bruto, e é
  temporária e fora do backup. Afirmações e fatos são frases curtas redigidas pelo modelo.
- **O app não lê nada disto.** Fatos de capítulo são spoiler por natureza; a leitura passa pela
  função compartilhada da §6.4.
- **O `summary` é interno** (lastro do quiz), nunca exibido ao leitor: "a IA não lê por você"
  (`docs/product.md` §1).
- **Sem dado pessoal.** Nada aqui entra em `delete-account` nem em LGPD.

## 5. Política de fonte

Tudo em código, aplicado **antes** de o texto chegar à IA. Toda decisão vai para
`ingestion_sources` com o motivo.

1. **Acesso:** só `http(s)` público. Login, paywall, 401/403 ou captcha: rejeitado
   (`acesso_restrito`). User-agent `BeReadingBot/1.0 (+https://github.com/ph-tavares/BeReading)`, no máximo 1 requisição a
   cada 2 s por domínio.
2. **robots.txt** respeitado (cache por domínio, 24 h), e também `X-Robots-Tag` e meta com `noai`
   ou `noindex` (`robots`).
3. **Lista de domínios:** `blocked` rejeita (`dominio_bloqueado`). `allowed` usa o peso da lista.
   Domínio fora da lista entra com peso D (§6.2).
4. **Texto integral (corpo do livro),** detectado por arquivo do livro (PDF/EPUB) ou página com
   volume de texto típico do corpo da obra, é aceito de qualquer domínio **com sinal de
   autorização**:
   - domínio público no país de origem da obra, no país onde está hospedado ou no Brasil;
   - licença aberta declarada (Creative Commons, acesso aberto);
   - domínio oficial da editora, do autor ou de instituição;
   - repositório de acesso aberto na lista `allowed`.

   **Sem sinal, texto integral de obra protegida é rejeitado** (`texto_integral_sem_autorizacao`).
   Resumo, resenha, análise, guia de estudo e trecho não são texto integral e seguem as regras
   normais em qualquer domínio.
5. **Domínio público:** regra do país aplicável (Brasil: 70 anos contados de 1º de janeiro do ano
   seguinte à morte do autor, LDA art. 41; EUA e outros conforme a regra local). **Tradução tem
   direito próprio**: o texto só conta como domínio público se autor e tradutor estiverem. A base
   usada fica em `public_domain_basis`.
6. **Independência:**
   - mesmo domínio registrável (lista de sufixos públicos) = mesmo grupo;
   - conteúdo quase idêntico em domínios diferentes (simhash, antes de apagar o texto) = cópia,
     mesmo grupo.
7. **Peso:**
   - **A** texto primário legítimo (domínio público ou licença aberta);
   - **B** editora, base bibliográfica, enciclopédia;
   - **C** sites editoriais e de estudo estabelecidos (na lista `allowed` com peso C);
   - **D** blogs, fóruns, resenhas de leitores e domínio fora da lista.
8. **Texto buscado é dado, nunca instrução:** delimitadores no prompt, como em
   `generate-questions/prompt.ts` (PR #28).
9. **Segurança do fetch (SSRF):** só `http(s)`, IPs privados e de loopback bloqueados (checados
   depois da resolução DNS), no máximo 3 redirecionamentos com cada destino repassando a política,
   timeout de 15 s, 5 MB, PDF até 1.000 páginas.

## 6. Extração, verificação e spoilers

### 6.1 Extração (por fonte)

Uma chamada ao Haiku por fonte (textos longos em blocos). Saída JSON validada, no padrão de
`_shared/ai-json.ts`:

- **estrutura declarada pela fonte**, quando houver: lista de capítulos com parte, número e título;
- **afirmações**: `chapter_ref`, `kind`, `statement`, `is_interpretation`, `forward_reference`.

Instruções do prompt: afirmação só entra num capítulo quando **a própria fonte a localiza nele**
(cabeçalho de capítulo, resumo capítulo a capítulo); texto do livro inteiro ou sem localização gera
afirmação sem `chapter_ref`; nada de citação literal; marcar `forward_reference` quando a frase
revela algo de capítulo posterior.

### 6.2 Confirmação (por capítulo)

**Localização** (código): `chapter_ref` → `edition_chapters` por número sequencial, por parte +
número ou por título normalizado. Ambíguo ou sem referência: `located = false`, fora de qualquer
capítulo. `forward_reference = true`: fora do capítulo.

**Agrupamento** (Haiku, uma chamada por capítulo com as afirmações localizadas): devolve grupos de
afirmações equivalentes e pares contraditórios. O modelo só agrupa.

**Decisão** (código, funções puras):

| Situação | Resultado |
|---|---|
| Apoio de 1 fonte peso A | confirmado |
| ≥ 2 grupos independentes, pelo menos 1 com peso B ou C | confirmado |
| ≥ 3 grupos independentes, todos peso D | confirmado |
| Contradição com apoio comparável | nenhum dos lados entra; se um lado tem fonte A, A vence |
| Abaixo disso | não entra (fica em `ingestion_claims`) |

- **Tema e interpretação:** exigem 2 grupos independentes; marcados `is_interpretation`; alimentam
  só perguntas de reflexão.
- **Confiança do fato:** `1 − Π(1 − w)` sobre os grupos de apoio, com `w` = A 1,0 · B 0,7 · C 0,5 ·
  D 0,3, menos penalidade de contradição.
- **Status do capítulo:** `confirmed` com ≥ `MIN_FACTS_CONFIRMED` fatos confirmados, `partial` com
  pelo menos 1, `insufficient` com 0.
- Os limiares são constantes nomeadas em `_shared/ingestion/rules.ts`, calibradas no teste de
  aceitação (§8.5). Valores iniciais: `MIN_FACTS_CONFIRMED = 5`, penalidade de contradição 0,3.

### 6.3 Estrutura da edição

A estrutura declarada pelas fontes passa pelas mesmas regras de independência:

- confirmada por texto primário (peso A) **da mesma edição ou do mesmo original com a mesma divisão**,
  pelo sumário da própria edição (editora, ISBN) ou por 2 grupos independentes que concordem em
  quantidade, ordem e títulos;
- estruturas em conflito entre edições: vale a que vem de fonte ligada ao ISBN; sem isso, não
  confirma;
- sem estrutura confirmada, nenhum fato é localizado e o run termina `partial` com motivo
  `estrutura_nao_confirmada`.

### 6.4 Spoilers

1. **Extração:** afirmação com `forward_reference` sai do capítulo.
2. **Publicação:** o `summary` do capítulo é escrito só com fatos confirmados daquele capítulo.
3. **Uso:** `_shared/ingestion/knowledge.ts` expõe
   `getKnowledgeUpTo(editionId, currentChapterNumber)`, a **única** leitura da base para consumo.
   Nunca devolve fato de capítulo com `number > currentChapterNumber`. Quiz, conversa e
   personalização (próximos ciclos) passam por ela.

## 7. Falhas, custo e operação

### Falhas

- **Transitórias** (rede, timeout, 429, 5xx de Tavily, Anthropic ou site): até 3 tentativas, com
  espera de 1 min, 5 min e 30 min.
- **Permanentes** (rejeição de política, 404, página sem texto útil, JSON inválido após as
  tentativas): sem retry, motivo gravado.
- **Worker que morreu:** passo com `locked_at` há mais de 5 min volta para `pending`.
- **Fim do run:** `succeeded` (todo capítulo `confirmed`), `partial` (algum `partial` ou
  `insufficient`, ou limite atingido), `failed` (edição não resolvida ou nenhuma fonte aceita).
  `partial` e `failed` chamam `notifyOps`.
- **Nova busca:** capítulo `insufficient` recebe `next_recheck_at` = +7 dias, até 3 vezes; o worker
  cria um run de rebusca só para esses capítulos.

### Limites (constantes nomeadas)

| Limite | Valor inicial | Ao atingir |
|---|---|---|
| Buscas por run | 30 | run `partial`, motivo `limite` |
| Fontes lidas por run | 60 | idem |
| Custo estimado por run | US$ 2,00 | idem |
| Créditos Tavily por dia | 30 | runs aguardam o dia seguinte |
| Runs novos por dia | 10 | idem |
| `INGESTION_ENABLED` | `true` | `false` para tudo sem deploy |

Custo estimado = tokens reais do `usage` de cada chamada × preço do modelo + créditos Tavily ×
US$ 0,008.

### Estimativa por livro (20 capítulos, a confirmar pelos contadores)

| Item | Custo |
|---|---|
| Tavily: ~25 buscas | ~25 créditos (dentro do gratuito) |
| Extração Haiku: ~40 fontes × ~6 mil tokens de entrada, ~800 de saída | ~US$ 0,40 |
| Agrupamento: 20 capítulos × ~3 mil de entrada, ~1 mil de saída | ~US$ 0,16 |
| **Total** | **~US$ 0,60 por livro** |

### Código e configuração

- `callAI` sai de `generate-questions/index.ts` para `_shared/ai.ts`, devolvendo também `usage`.
  `generate-questions` passa a importar de lá, sem mudança de comportamento.
- Novo secret: `TAVILY_API_KEY`. A chave de IA já existe em produção.
- Módulos puros em `supabase/functions/_shared/ingestion/`: `policy.ts`, `public-domain.ts`,
  `independence.ts`, `locate.ts`, `rules.ts`, `queue.ts`, `knowledge.ts`, `budget.ts`, `ssrf.ts`.
  Adaptadores com I/O: `openlibrary.ts` (reaproveita o parser da BER-72), `googlebooks.ts`,
  `tavily.ts`, `fetch-page.ts` (HTML com Readability, PDF com `unpdf`; compatibilidade com o Edge
  Runtime verificada no plano).
- `docs/deploy.md`: secret novo, exclusão do backup, `INGESTION_ENABLED` e como disparar um run.
- `AGENTS.md`: as duas functions novas entram na lista do `deno check`.

## 8. Testes

1. **Unidade (Deno, funções puras, TDD):** edição (parsers Open Library e Google Books); domínio
   público por país, incluindo tradução protegida de obra em domínio público; política (robots,
   lista, login/paywall, texto integral com e sem sinal de autorização, PDF de licença aberta);
   SSRF; independência (domínio registrável, cópia por simhash); localização (número, parte +
   número, título, ambíguo, `forward_reference`); cada linha da tabela de confirmação; contradição
   com e sem fonte A; confiança; status do capítulo; fila (reivindicação, retry com espera, trava
   velha, transitório vs permanente); limites; parsing do JSON da IA.
2. **Spoiler:** `getKnowledgeUpTo` com fatos de todos os capítulos nunca devolve capítulo posterior.
3. **Handler** (padrão de `generate-questions/handler.test.ts`): `ingest-book` recusa chamador sem
   chave interna; `process-ingestion` executa passos completos com Tavily, Anthropic e sites
   simulados.
4. **Banco:** a migration aplica do zero (dry run do deploy); teste que prova que `anon` e
   `authenticated` não leem nenhuma tabela nova.
5. **Dados de teste:** o repositório é público, então fixtures são **sintéticas ou de domínio
   público** (*Dom Casmurro*, Gutenberg). Nenhum texto de livro protegido ou de resenha de terceiros.
6. **Aceitação com livros reais** (critério registrado em 15/09 na BER-59, antes de qualquer
   resultado), executada em produção pelo endpoint interno:
   - **livros:** os 3 do piloto (*1984*, domínio público no Brasil desde 2021; *Coraline* e *O Guia
     do Mochileiro das Galáxias*, contemporâneos) e **1 não-ficção argumentativa a escolher**; 2
     capítulos por livro;
   - **gabarito às cegas** por quem leu: fatos-chave, 3 spoilers de capítulos posteriores e a
     estrutura da edição do ISBN. As paráfrases do piloto servem de referência, não de gabarito;
   - **aprovação:** precisão ≥ 90%, cobertura ≥ 70%, zero spoiler (eliminatório), no máximo 1 fato
     inventado; também medidos estrutura, atribuição, calibração da confiança, custo e tempo;
   - **braços P, S e P+S** calculados da mesma execução, filtrando por `source_type`;
   - **relatório de fontes rejeitadas por motivo**, incluindo PDFs (`texto_integral_sem_autorizacao`).

Enquanto não houver chave da Anthropic no ambiente local, a suíte automática usa simulação e as
execuções reais acontecem em produção. É seguro: o app não lê as tabelas novas.

## 9. Divergência do piloto

Consulta em produção em 16/09/2026: a estrutura de capítulos do piloto não corresponde aos livros.

| Livro | No banco | Livro real (a confirmar pelo pipeline) | Leitores / respostas |
|---|---|---|---|
| *1984* | 9 capítulos ("Parte 1 – Cap. 1…4, Parte 2 – Cap. 1…3, Parte 3 – Cap. 1…2") | 3 partes, 8 + 10 + 6 = 24 capítulos | 9 / 22 |
| *Coraline* | 8 capítulos | 13 capítulos | 5 / 5 |
| *O Guia do Mochileiro das Galáxias* | 8 capítulos | 35 capítulos | 3 / 8 |

Por isso este ciclo não altera `chapters`: o run grava a estrutura confirmada em `edition_chapters`
e a diferença em `ingestion_runs.structure_divergence`. A reconciliação (estrutura nova no app e
migração do progresso dos leitores) é o primeiro item do próximo ciclo.

## 10. Pendências do time

- ISBN da edição de cada livro do piloto e a escolha da não-ficção argumentativa.
- Gabarito às cegas dos 8 capítulos de aceitação.
- Conta no Tavily e secret `TAVILY_API_KEY` em produção.
- **Texto integral de obra protegida sem sinal de autorização:** a política deste design rejeita e
  registra o motivo. O time defende consumir; a decisão de mudar essa regra fica com o time e deve
  vir com parecer jurídico. O relatório de rejeitados (§8.6) dá o número para essa conversa.

## 11. Refinamentos do plano de implementação

Decididos ao escrever `docs/superpowers/plans/2026-09-16-ber-59-ingestao-conteudo-capitulo.md`:

1. `source_domain_policies` ganha `source_type`, `authorizes_full_text` e `host_country`.
2. `ingestion_sources` ganha `is_book_file`, `tied_to_isbn` e `declared_structure`.
3. `book_editions.title` é nullable e a tabela ganha `first_publish_year`.
4. `ingestion_runs` ganha `payload` (capítulos de rebusca).
5. O conhecimento do capítulo é gravado no `verify`; o `publish` só fecha o run.
6. A extração é um passo por bloco de texto, não por fonte.
7. Domínio público é avaliado no Brasil, nos EUA e no país de hospedagem; o país de origem não vem
   das bases bibliográficas. O idioma original é o da edição mais antiga da obra na Open Library.
8. robots.txt fica em cache por execução do worker, não por 24 h.
9. Estrutura de capítulos confirma com texto primário ou 2 grupos independentes de qualquer peso;
   a regra mais rígida da §6.2 vale para fatos de enredo.

Decididos ao executar o plano (PR 1 e PR 2):

10. As FKs de `chapter_knowledge.run_id` e `chapter_fact_sources.source_id` são
    `on delete no action deferrable initially deferred`, para uma poda de run só falhar (nunca
    apagar em cascata conhecimento publicado), e a checagem adiada até o fim da transação evita a
    ordem das cascatas travar a purga da edição.
11. A troca de capítulos de uma edição usa a função transacional `replace_edition_chapters`, que
    preserva o capítulo com identidade compatível entre a estrutura antiga e a nova (e o
    conhecimento já ligado a ele) em vez de apagar tudo e recriar.
12. Resolução de DNS: host que não resolve é rejeitado; NXDOMAIN (sem endereço) é distinto de
    falha do resolvedor (timeout, rede, permissão), que vira `TypeError` e o passo é repetido como
    transitório pela fila (§7). `ResolveFn` devolve `null` só quando o runtime não expõe API de
    DNS; em produção isso recusa o host (fail-closed), a menos que o secret
    `INGESTION_ALLOW_NO_DNS=true` libere de propósito.
13. A checagem de SSRF também bloqueia IPv4 escrito como IPv6 (mapeado, compatível, NAT64, 6to4),
    além de multicast e da faixa TEST-NET.
14. A estrutura de capítulos não confirma quando existe candidato válido incompatível fora do
    apoio sem nenhuma fonte ligada ao ISBN, nem quando uma fonte sem títulos serve de ponte entre
    duas estruturas rivais e as confirmaria ambas.
15. O delimitador usado para interpolar texto não confiável nos prompts é removido desse texto
    antes de montar o prompt (defesa contra injeção).
16. `insertSource` é insert-or-return-existing: uma URL já registrada no run devolve a decisão
    existente em vez de sobrescrevê-la.
17. O store do Supabase pagina leituras de lista além do `max_rows` (1000) do PostgREST, e os
    erros de rede carregam o status HTTP (status 0, sem resposta, é tratado como transitório).
18. A extração é idempotente por bloco de texto: `ingestion_claims.chunk_index` (migration
    `20260918120000`) identifica o bloco, e uma retentativa apaga as afirmações daquele bloco
    antes de reinserir.
19. Agendar uma rebusca adia `next_recheck_at` (nunca grava `null`) antes de criar o run, para uma
    falha na criação só atrasar a próxima tentativa em vez de parar de rebuscar o capítulo.
20. As dependências `npm:` (`tldts`, `linkedom`, `@mozilla/readability`, `unpdf`) são fixadas em
    versão exata, porque o repositório não tem `deno.lock`.
21. Risco residual aceito de DNS rebinding: o IP é checado numa resolução e o `fetch` resolve o
    nome de novo, então um DNS malicioso pode trocar o endereço entre as duas. O `fetch` do Deno
    não permite fixar o IP resolvido. O impacto é limitado: o worker só faz `GET` sem credencial e
    nenhuma resposta bruta é devolvida a ninguém (o texto só alimenta a extração e é descartado),
    então na prática é uma requisição cega.
