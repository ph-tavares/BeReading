# Assistente de leitura: design

- **Data:** 2026-09-20 · **Status:** decisões fechadas com o time de produto; aguarda revisão desta spec
- **Base:** `main` @ `d0ce5d2`
- **Origem:** sessão de grilling de 17 a 20/09/2026. As decisões com motivo e evidência estão em
  `bereading-docs/produto/assistente-de-leitura/decisoes.md` (repositório privado); a pesquisa crua,
  em `bereading-docs/pesquisa/assistente-de-leitura-2026-09.md` e
  `bereading-docs/pesquisa/sessao-de-leitura-viabilidade-tecnica-2026-09.md`.
- **Relacionadas:** BER-59 (base de conhecimento por capítulo), BER-60 (cadastro de livro fora do
  catálogo), BER-58/61 (planos), BER-77 (redesign e a persona "Orelha").

> Este documento é público, como o repositório. Não traz dado de pesquisa com pessoa
> identificável nem material de negócio — esses ficam no repositório privado.

---

## 1. Objetivo

Dar ao leitor **ajuda para entender a página que ele está lendo agora**, sem nunca ler por ele.

A promessa, na voz do produto:

> **Tire qualquer dúvida do seu livro na hora. Ele já sabe qual livro é e até onde você leu.**

O desenho é para uma **situação**, não para uma faixa etária: alguém lendo um livro acima do
próprio repertório. Isso cobre tanto quem encara *1984* aos 19 anos quanto quem encara um livro
técnico ou em outra língua.

**Por que isso, e não um assistente genérico:** o leitor já tem um LLM no bolso. Onde um LLM
genérico é pior é exatamente onde o contexto de leitura importa — ele não sabe o livro, não sabe a
página, e exige que a pessoa monte o contexto e peça "sem spoiler" na mão. É nesse vão que o
assistente existe.

### 1.1 O que ele NÃO é

Vale tanto quanto a lista do que ele é (`docs/product.md` §1 e §4):

- **Não resume o livro, nem capítulo, nem página que a pessoa ainda não leu.** Se uma feature
  permite pular a leitura, ela é contra o produto.
- **Não é prova.** O quiz mede compreensão depois do capítulo; o assistente ajuda durante.
- **Não é chat com personagem do livro.** Continua sendo visão, não roadmap.
- **Não lê por memória.** Ver §6.2.

---

## 2. Decisões

| # | Decisão | Descartado, e por quê |
|---|---|---|
| D1 | Atende todos os momentos de dúvida (travei, curioso, retomada, técnico, língua estrangeira), mas o design foca nos casos em que conhecer o livro e a posição faz diferença | Atender só "travei": os outros momentos aparecem de graça no mesmo mecanismo |
| D2 | **A linha é híbrida por tipo de dúvida** (§3.2): bloqueio recebe resposta direta; interpretação recebe convite a pensar antes da leitura possível; resumir ou adiantar é proibido | Socrático sempre (irrita leitor adulto e é o design que os usuários pior avaliam); aberto tipo LLM genérico (vira resumo sob demanda) |
| D4 | Promessa = companhia contextual (§1) | "Nunca mais largue um livro": a evidência aponta falta de tempo, não dificuldade, como motivo nº 1 de não ler mais. Prometeria o que o assistente não entrega |
| D5 | Vive **dentro** da sessão de leitura (quando ela existir), com dois relógios: tempo de leitura e tempo de assistente medidos à parte; só o de leitura gamifica | Um relógio só: conversar com a IA passaria a valer XP, e o caminho mais fácil para subir de nível seria conversar em vez de ler |
| D6 | Deixa rastro em dois níveis: conversa crua + itens estruturados extraídos dela | Só conversa: perde o acúmulo, que é onde o leitor vê o quanto aprendeu |
| D10 | **Interação híbrida:** a foto abre 3 ou 4 perguntas sugeridas, escritas a partir daquela página, mais campo aberto | Campo em branco puro (transfere ao leitor o trabalho de saber o que pedir, e é o que faz alguém digitar "resume isso"); só botões fixos (não cobre a dúvida real) |
| D11 | A foto é o caminho principal **e também dá a posição**, quando o número impresso for legível; senão o app pergunta a página. Posição nunca atualiza o progresso sem confirmação | Confiar só no progresso registrado: ele fica atrás da leitura real. Atualizar sozinho: OCR erra, e escrita de progresso é do servidor |
| D12 | Superfície nova. Personagem, nome e voz ficam para decisão própria com o time; pode acabar sendo a "Orelha" | Herdar a Orelha agora: o nome já está marcado como provisório em `mobile/src/assistant/persona.ts:3` |
| D15 | Spoiler travado por padrão, com liberação explícita **por pergunta**, inline na resposta | Chave global: uma configuração ligada há três meses vira spoiler que ninguém pediu hoje |
| D16 | Entra no plano gratuito com **limite diário**; Premium com limite alto e teto de abuso | Só no Premium (mata a experiência que vende o produto); cota mensal (acaba no dia 8 e deixa o leitor 20 dias sem o produto) |
| D17 | Métrica de decisão: **voltou a ler**. As quatro são instrumentadas, nesta ordem de peso: voltou a ler, terminou, uso, acúmulo | Uso como métrica principal: sobe tanto quando o assistente ajuda quanto quando a pessoa está perdida |
| D18 | A foto vai para o **modelo multimodal**, e a mesma chamada devolve resposta, transcrição e sugestões. A imagem não é guardada | OCR no aparelho: é código nativo, não roda no Expo Go. Fica como otimização para quando houver build nativo |
| D19 | A conversa fica gravada inteira, inclusive a transcrição | Apagar o texto depois: inviabiliza continuar a conversa sem fotografar de novo a cada pergunta |
| D20 | Sem livro na estante, funciona igual, só sem o contexto do livro (§3.4) | Exigir livro do catálogo: hoje são 3 livros e o leitor não consegue cadastrar nenhum |
| D21 | Portas de entrada no ciclo 1: **tela do livro** e **card na Hoje** | Botão flutuante na Hoje: disputaria com o CTA "Registrar leitura" e com o card da Orelha, contra a regra "um acento por tela" (`mobile/DESIGN.md:277`). Ele nasce dentro da sessão, onde não briga com nada |
| D22 | Resposta **curta primeiro** (na ordem de 3 a 6 frases, menor que a de um assistente de busca), com aprofundamento sob demanda; sempre em português, citando o trecho no idioma original; sem emoji | Resposta longa em bolha: cansa e atrasa a volta ao livro |
| D23 | Falhas tratadas explicitamente (§7) | Tela de erro genérica |

A numeração segue o placar em `bereading-docs/produto/assistente-de-leitura/decisoes.md`. As que
faltam aqui são de processo (D3, D9: construir e pesquisar em paralelo, §10), de dados (D7, D19,
§5), do JEV (D8, §9) ou da sessão de leitura (D13, D14), que tem spec própria.

---

## 3. A experiência

### 3.1 Fluxo principal

```
leitor trava numa página
  → abre o assistente (tela do livro, card da Hoje, ou, no futuro, dentro da sessão)
  → tira a foto da página
  → o servidor devolve: transcrição do trecho + 3 ou 4 perguntas sugeridas + posição detectada
  → o leitor toca numa sugestão, ou digita a dúvida dele
  → resposta curta, com "quer que eu aprofunde?"
  → a conversa continua sem precisar de foto nova
  → se a posição detectada estiver à frente do progresso: "quer registrar até aqui?"
```

### 3.2 A linha, na prática

A regra que separa ajudar de ler pela pessoa:

| Tipo de dúvida | Comportamento | Exemplo |
|---|---|---|
| **Bloqueio** — palavra, referência, contexto histórico, frase truncada | Resposta direta e curta, que devolve ao livro | "o que é anacrônico", "quem foi Trótski", "o que significa esta expressão aqui" |
| **Interpretação** — sentido, intenção, motivação | Convida a arriscar a leitura própria, depois oferece uma leitura possível, nunca "a resposta certa" | "o que o autor quis dizer com isso", "por que o personagem fez isso" |
| **Proibido** | Recusa curta e honesta, com oferta do que dá para fazer | "resume o capítulo", "me conta o que acontece no final", "o que acontece depois" |

A assimetria é deliberada. Exigir reflexão de quem só perguntou o significado de uma palavra irrita
um leitor adulto, e o prompt do quiz já trata o leitor como adulto e autônomo. Por outro lado,
entregar interpretação mastigada é justamente substituir o esforço que a leitura exige.

**Evidência que sustenta essa escolha** (detalhe em `bereading-docs/pesquisa/`): num ensaio
controlado com cerca de mil estudantes (Bastani et al., PNAS 2025), IA sem trava melhorou o
desempenho enquanto disponível e **derrubou 17% a nota na prova sem IA**; a versão que dava pistas
em vez de respostas não causou dano. E conhecimento prévio é o gargalo mais documentado da
compreensão de texto denso (Recht & Leslie 1988; O'Reilly et al. 2019) — ou seja, **dar contexto não
é ler pela pessoa, é deixar ela ler**.

### 3.3 Perguntas sugeridas

São escritas a partir do texto daquela página, não são um menu fixo. Numa página de *1984* que
apresenta "duplipensar", as sugestões seriam do tipo: *o que é duplipensar*, *me explica este
parágrafo*, *quem é O'Brien*, *o que rolou antes disto*. Sempre há uma opção de perguntar outra
coisa, que abre a conversa com o assistente puxando o assunto.

Isso resolve dois problemas de uma vez: elimina o "não sei o que pedir" e **faz o roteamento pela
interface** — cada sugestão é um tipo de dúvida conhecido, com prompt e fontes próprios, sem
precisar de classificador. Só o texto livre precisa ser roteado.

### 3.4 Quando o livro não está na estante

Hoje o catálogo tem 3 livros (seed do baseline) e o leitor não consegue cadastrar nenhum. O
assistente **degrada com elegância**:

- **Com livro na estante:** usa título, autor, capítulo, posição e, quando existir, a base
  verificada da BER-59.
- **Sem livro:** funciona a partir da foto, e pergunta o título quando isso mudar a resposta.

Quando a BER-60 existir, o cadastro por ISBN passa a alimentar esse contexto sem mudar o desenho
das telas.

---

## 4. Arquitetura

```
app (Expo)                     Edge Functions (Deno)                   Postgres
──────────                     ─────────────────────                   ────────
CameraView ──foto──▶ scan-page ──imagem──▶ modelo multimodal
                       │  devolve: transcrição + sugestões + página detectada
                       └──────────────▶ assistant_conversations / assistant_messages
composer ───pergunta──▶ ask-assistant ──prompt + transcrição + contexto──▶ modelo
                       │  aplica: cota do plano, trava de spoiler, política de fonte
                       └──────────────▶ assistant_messages
```

Duas Edge Functions novas, no padrão da casa (`index.ts` exporta `handler(req)`, regra de negócio em
módulo irmão com nome de domínio, teste do handler contra o `fakeSupabase`):

- **`scan-page`** — recebe a imagem; devolve transcrição, sugestões e a página detectada.
- **`ask-assistant`** — recebe a pergunta e o id da conversa; devolve a resposta.

Módulos puros: `prompt.ts`, `suggestions.ts`, `spoiler.ts`, `conversation.ts`, `quota.ts`.

**Invariantes respeitados** (`AGENTS.md` §3): o dono da ação vem do JWT (`resolveUserId`); o cliente
não escreve nada — as duas funções gravam com a chave de serviço; falha passa por `notifyOps`;
nenhum segredo vai para o app.

### 4.1 Mudança necessária no `_shared/ai.ts`

Hoje `AIRequest` só aceita `prompt: string`, e as duas implementações montam
`messages: [{ role: 'user', content: req.prompt }]`. Para imagem:

- `AIRequest` ganha um campo opcional de imagem (base64 + media type);
- no caminho Anthropic, o `content` vira lista de blocos, com o bloco de imagem antes do texto;
- no caminho OpenAI, o equivalente com `image_url`;
- **se o provedor configurado não suportar imagem, `scan-page` falha fechado** com erro claro e
  `notifyOps` — ausência de suporte nunca vira comportamento silencioso (`AGENTS.md` §3.8).

A imagem é redimensionada **no aparelho** antes de subir (borda maior na ordem de 1.500 px). Ela
não é gravada em lugar nenhum: nem em tabela, nem em Storage.

---

## 5. Dados

Migration nova. RLS ligada em todas as tabelas; **leitura só do dono, escrita só pelo servidor**,
como a BER-28 fez com a gamificação.

### `assistant_conversations`
`id`, `user_id`, `book_id` (nullable — D20), `chapter_number` (nullable), `detected_page`
(nullable), `book_title_text` (nullable, quando o livro não está na estante), `created_at`,
`last_message_at`.

### `assistant_messages`
`id`, `conversation_id`, `role` (`reader` | `assistant`), `content`, `kind` (`question` |
`answer` | `page_text`), `source_kind` (`photo` | `typed`), `spoiler_unlocked` (bool),
`model`, `input_tokens`, `output_tokens`, `created_at`.

A transcrição da página entra como mensagem de `kind = 'page_text'`, o que mantém a ordem da
conversa e evita uma tabela só para isso.

### `assistant_artifacts` (ciclo 2)
`id`, `user_id`, `conversation_id`, `message_id`, `kind` (`word` | `concept` | `learning` |
`curiosity`), `term`, `body`, `quote` (curta, nullable), `book_id`/`book_title_text`,
`chapter_number`, `confidence`, `created_at`.

### Regras de dados

- **A conversa inteira fica gravada, inclusive a transcrição** (D19). A pessoa possui o livro e só
  ela acessa o próprio chat.
- **Nunca cruza leitores.** A transcrição de um leitor não responde à pergunta de outro e não
  alimenta a base da BER-59. É essa a linha: o problema seria o texto chegar a quem não tem o livro.
- Isso **amplia a exceção** à regra "nenhum texto literal de obra fica gravado" (spec BER-59 §4). A
  pendência jurídica da BER-59 §10 passa a cobrir este caso.
- **As três tabelas entram em `USER_OWNED_TABLES`** (`delete-account/index.ts`), senão apagar a
  conta deixa a conversa para trás.
- Nada aqui é lido pelo app sem ser do próprio dono; nenhum dado de terceiro é armazenado.

---

## 6. Prompt, fundamentação e spoiler

### 6.1 Fontes por tipo de dúvida

| Tipo | Fontes |
|---|---|
| Palavra, expressão, referência | Foto/transcrição + conhecimento de mundo do modelo |
| "O que estava acontecendo" | Transcrição + base verificada da BER-59 **até a página atual** (`getKnowledgeUpTo`) |
| Curiosidade, conceito, contexto histórico | As anteriores + busca na web, **atrás de um gesto explícito** |
| Interpretação | Transcrição, e só o que a pessoa já leu |

`getKnowledgeUpTo` existe desde a BER-59 (`_shared/ingestion/knowledge.ts`) e **hoje não tem nenhum
consumidor**. Este é o primeiro. Vale o aviso honesto: a cobertura da base é quase zero até a
ingestão rodar para livros reais, então no ciclo 1 o lastro é a foto mais o conhecimento de mundo.

### 6.2 A regra da memória

> **O modelo pode usar o que ele sabe do mundo. Ele não pode usar o que ele acha que lembra do
> livro.**

Quem foi Trótski, o que é um panóptico, o que significa "anacrônico": conhecimento de mundo,
legítimo, e é exatamente o conhecimento prévio que destrava a compreensão. Já "o que acontece no
capítulo 7" só pode sair da transcrição ou da base verificada — e, na falta delas, a resposta é que
não sabe. O teste da BER-59 mostrou por quê: sobre 8 capítulos de *Dom Casmurro*, de memória, o
modelo acertou 4, errou 2 (um deles com invenção específica) e se absteve em 1.

### 6.3 Spoiler

1. **Padrão travado:** nada além da posição conhecida.
2. **Liberação por pergunta**, inline: *"isso acontece depois de onde você está — quer que eu conte
   mesmo assim?"*, com o botão ali. Fica registrado em `spoiler_unlocked`.
3. **Posição desconhecida → modo mais apertado:** só o que a pessoa mandou.
4. **Instrução no prompt não basta.** Modelos memorizaram livros populares e podem vazar o final sem
   receber o texto; o Kindle vazou spoiler no lançamento do "Ask this Book" e teve que restringir.
   Por isso o teste de aceitação da §8 é eliminatório.

### 6.4 Texto da foto é dado, nunca instrução

Mesmo padrão já usado em `generate-questions/prompt.ts` e na ingestão: delimitadores explícitos, o
delimitador removido do texto interpolado, e instrução de nunca seguir ordens vindas de dentro do
conteúdo. Uma página fotografada é entrada não confiável como qualquer outra.

---

## 7. Falhas, cota e custo

### Falhas

| Situação | Comportamento |
|---|---|
| A foto não é página de livro | Recusa curta e **não consome cota** |
| Foto ilegível | Pede outra foto, com dica (luz, enquadramento); não consome cota |
| Modelo indisponível ou erro de API | Mensagem honesta, `notifyOps`, não consome cota |
| Sem internet | Mensagem explícita, com a conversa preservada |
| Provedor sem suporte a imagem | Falha fechada, `notifyOps` (§4.1) |

### Cota

Secrets novos, no padrão de `_shared/plan-rules.ts` (inteiro ≥ 0 ou `unlimited`, valor inválido cai
no default):

| Secret | Default | O que limita |
|---|---|---|
| `FREE_DAILY_ASSISTANT_MESSAGES` | `3` | Perguntas por dia no plano gratuito |
| `ASSISTANT_DAILY_CAP` | `100` | Teto de abuso, vale inclusive para Premium |

Limite **diário**, não mensal: o assistente é situacional — a pessoa trava numa página hoje.

### Custo

Com `claude-haiku-4-5` (US$ 1,00 por milhão de tokens de entrada, US$ 5,00 de saída):

| Item | Tokens | Custo |
|---|---|---|
| Foto de página redimensionada | ~1.600 entrada | ~US$ 0,0016 |
| Transcrição + sugestões | ~700 saída | ~US$ 0,0035 |
| Pergunta seguinte, sem foto | ~1.500 entrada / ~250 saída | ~US$ 0,003 |

**Ordem de US$ 0,005 por interação com foto.** Três por dia, no uso máximo do plano gratuito, dão
cerca de **US$ 0,27 por leitor por mês**. Cada chamada grava `input_tokens` e `output_tokens`, para
o custo ser medido e não estimado.

---

## 8. Testes

1. **Unidade (Deno, funções puras):** classificação do tipo de dúvida no texto livre; montagem do
   prompt com delimitadores; remoção do delimitador do texto interpolado; leitura da página
   detectada; regras de cota (diária, virada do dia, Premium, teto de abuso); decisão de spoiler por
   posição conhecida e desconhecida.
2. **Spoiler (eliminatório):** com a base de um livro conhecido, nenhuma resposta cita fato de
   capítulo posterior à posição. Inclui pergunta direta ("como termina?") e indireta ("esse
   personagem morre?").
3. **Handler:** `scan-page` e `ask-assistant` contra `fakeSupabase` e `mockAI` — chamador sem JWT,
   cota estourada, provedor sem imagem, foto que não é livro, conversa retomada.
4. **Banco:** a migration aplica do zero; teste provando que `anon` e `authenticated` não leem
   conversa de outro leitor; `delete-account` apaga as três tabelas.
5. **App (jest):** a tela de conversa renderiza sugestões, envia pergunta, mostra a recusa e o
   convite de liberação de spoiler; a folha fecha sozinha por inatividade.
6. **Aceitação com livro real**, com critério registrado **antes** de rodar: 10 páginas de 3 livros
   (um do piloto, um técnico, um em outra língua). Mede: utilidade da resposta julgada por quem leu,
   qualidade das sugestões, **zero spoiler** (eliminatório), zero invenção sobre o enredo, e custo
   real por interação.

---

## 9. Ciclos

**Ciclo 1 — a conversa ancorada (MVP).** Câmera, `scan-page`, sugestões, conversa, posição pela
foto com confirmação, trava de spoiler, cota por plano, histórico gravado, duas portas de entrada.
Sem dicionário, sem learnings, sem JEV.

**Ciclo 2 — o acúmulo.** Extração dos itens da conversa encerrada (palavra, conceito, learning,
curiosidade), dicionário do leitor, learnings, "o quanto você aprendeu" no perfil. É aqui que o
**JEV** entra: ele decide de forma tipada, com confiança calibrada, o que vira o quê. Ele **não
gera texto** e **não aceita imagem**, então nunca escreve resposta nem olha a foto; classifica a
conversa encerrada e roteia o texto livre, de forma incremental (guardando a última mensagem já
classificada). Sem chave ou fora do ar, a extração adia — o chat não quebra.

**Ciclo 3 — a sessão de leitura.** Feature irmã, com spec própria. O assistente passa a viver dentro
dela, com o botão persistente, os dois relógios e o fechamento automático da folha.

**Por que o acúmulo fica no ciclo 2:** não é menos importante — é que só dá para saber quais
categorias existem depois de haver conversas reais. Construir a extração antes é adivinhar.

---

## 10. Hipóteses e discovery

Construção e discovery correm **em paralelo** (decisão do time). Nada aqui bloqueia o ciclo 1; tudo
aqui pode corrigir a rota.

| # | Hipótese | Como validar |
|---|---|---|
| H1 | Dificuldade de compreensão faz o nosso público largar livro | Entrevistas sobre a última vez que largaram um livro. **A evidência disponível aponta contra**: no Retratos da Leitura 2024, 46% dos leitores citam falta de tempo |
| H2 | O entusiasmo do professor com o assistente vem de um caso real e recorrente | Conversa de 15 min sobre o que ele fez da última vez que travou num livro denso. A conversa que gerou o entusiasmo não está gravada em lugar nenhum |
| H3 | O leitor quer conversar com a IA durante a leitura sem quebrar o foco | Mágico de Oz: assistente por WhatsApp durante uma semana, observando o que perguntam de verdade |
| H4 | Guardar o que o leitor aprendeu gera valor percebido | Discovery + retorno aos itens salvos |

### Métricas

Ordem de peso: **voltou a ler** (páginas registradas depois de usar o assistente) → terminou
(capítulos e livros concluídos com e sem uso) → uso (interações por leitor ativo) → acúmulo (itens
salvos e retorno a eles). Com a base de usuários atual não há poder estatístico: servem como
direção, não como prova.

---

## 11. Pendências do time

- **Parecer jurídico** sobre guardar a transcrição da página fotografada no espaço privado do
  leitor (amplia a pendência da BER-59 §10).
- **Personagem e nome** de quem fala (D12), junto com a decisão sobre a "Orelha".
- **Provedor de IA em produção:** o caminho de imagem exige provedor com visão; confirmar o valor de
  `AI_PROVIDER` no projeto de produção antes do ciclo 1.
- **Gabarito do teste de aceitação** (§8.6) e escolha dos 3 livros.
- **BER-60** (cadastro por ISBN) como próximo passo natural do contexto do livro.
