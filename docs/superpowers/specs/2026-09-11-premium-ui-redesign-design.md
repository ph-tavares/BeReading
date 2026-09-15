# Redesign premium da interface: design

- **Branch:** `feature/premium-ui-redesign` (base `fd3fb9b`; integra o `main` em 15/09, ver o adendo no fim)
- **Issue:** BER-77 · relacionadas: BER-48 (PR #12), BER-72, BER-54, BER-42, BER-45, BER-51
- **Data:** 2026-09-11 · **Status:** aprovado no brainstorming; aguarda revisão desta spec
- **Mockups aprovados:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-mockups/` (abrir no navegador)
  - `01-auditoria-app-atual.html`: estado atual, com os atritos marcados
  - `02-design-system.html`: fundação (Seção 1)
  - `03-assistente-e-voz.html`: voz 18–24 e presença do assistente
  - `04-loop-central.html`: Hoje → registrar → capítulo fechado (Seção 2)
  - `05-telas.html`: livro, quiz, estante, explorar, você, entrada (Seção 3)
- **Precedência:** onde mockup e spec divergem, vale esta spec. Os números de página do mockup 04
  são ilustrativos: os capítulos reais do Mochileiro estão no seed (cap. 4 = p. 61–85). Na voz,
  vale o mockup 03 e a §3.5; a tabela de voz do mockup 02 é a versão sóbria, que foi superada.

## 1. Objetivo

Transformar o app mobile de MVP funcional em produto com cara de publicado, **sem mudar a
lógica**. O critério final: colocar lado a lado o app atual e o redesign e a evolução ser
evidente em profissionalismo, identidade, consistência e percepção de valor.

**Público: jovens de 18 a 24 anos.** Esta faixa corrige o "18–45" registrado no pitch B2C. Continua
sem menor de idade, então a BER-29 não reabre. O produto quer que o jovem **queira ler**: o hábito
e o assistente de leitura são o centro.

**Prioridade:** UX → clareza → identidade → impacto visual → motion → performance.

### Fora de escopo

Backend, banco, migrations, auth, API e regras de negócio. O que exigir isso vira issue própria.
Especificamente fora: busca por ISBN no app (BER-72 tem só o backend), termos de uso (BER-51),
upgrade do Expo SDK (o iPhone continua sem abrir pelo Expo Go), textos de medalha no seed ("fora da
grade escolar"), XP persistido no banco.

## 2. Decisões tomadas

| # | Decisão | Alternativas descartadas |
|---|---|---|
| D1 | **Mídia principal = o livro.** Mascote e ilustrações infantis saem da interface; os arquivos ficam no repo. Capa real quando houver `cover_url`, capa tipográfica gerada quando não. Ícone e splash novos. | rebaixar o mascote; manter tudo |
| D2 | **Gamificação refinada.** XP, nível e conquistas no centro, com acabamento premium. | hábito adulto sem XP; manter como está |
| D3 | **XP derivado** de dados persistidos, em módulo puro e testado. Zero migration. | XP persistido (backend); tirar o XP |
| D4 | **Direção "Noturno editorial"** com o **anel de nível** da direção "Grafite atlético". | grafite atlético; capa como palco |
| D5 | **4 abas, ação no contexto:** Hoje · Estante · Explorar · Você. Registrar leitura é o botão principal da Hoje e do detalhe do livro. | ação central na tab bar; 3 abas |
| D6 | **Voz jovem sem ser infantil** (18–24). | sóbria adulta; juvenil atual |
| D7 | **Assistente como conversa.** O quiz vira papo com a Orelha (nome provisório). | narrador; discreto |
| D8 | **Primitivos próprios** (`src/ui`), StyleSheet, Reanimated 4, sheets nativos do expo-router. | NativeWind; Tamagui |
| D9 | BER-48 entra antes (PR #12). O redesign rebaseia antes de tocar em livro e quiz. | empilhar; resolver no merge |

## 3. Design system

Fonte da verdade: `mobile/src/theme/tokens.ts` (TS tipado). O `mobile/DESIGN.md` é a versão
legível para humanos e agentes, no schema de 9 seções do padrão da Wiki
(`standards/frontend/design-system-contract.md`). Nenhum valor visual existe fora dos tokens.

### 3.1 Cor

Neutros quentes (tinta e papel) e **um acento só**. Contraste medido em WCAG 2.1, com `bg` como referência.

| token | valor | uso | contraste |
|---|---|---|---|
| `bg` | `#12100E` | fundo das telas | n/a |
| `surface1` | `#1B1916` | cards, sheets, tab bar | n/a |
| `surface2` | `#25221E` | inputs, trilhas, botão secundário | n/a |
| `surface3` | `#302C27` | pressed / selecionado | n/a |
| `text` | `#F3EDE2` | texto principal | 16,3 |
| `text2` | `#B9B0A3` | texto secundário | 8,9 |
| `text3` | `#978E82` | legenda, desabilitado | 5,9 (≥ 4,9 em todas as superfícies) |
| `accent` | `#F0A83A` | progresso e ação primária, **apenas** | 9,4 |
| `accentInk` | `#1B1206` | texto sobre accent | 9,1 sobre accent |
| `accentSoft` | `rgba(240,168,58,.14)` | aviso, chip de XP | n/a |
| `positive` | `#8CC28F` | sucesso | 9,3 |
| `danger` | `#EE7B67` | erro, destrutivo | 6,9 |
| `line` / `line2` | `text` @ 8% / 14% | divisória / borda | n/a |
| `floating` | `#2A2622` | toast, superfície flutuante | n/a |

**Paleta de capas geradas** (creme `#F6E9D4` sobre todas ≥ 5,3): `#5E2A2A` `#2F4A3A` `#22324F`
`#7A5A1E` `#4A2F4F` `#1F4A4F` `#3A3F47` `#7A3B22`. A cor é escolhida por hash determinístico do
`book.id`, como hoje em `coverFromId`.

### 3.2 Tipografia

Duas famílias com papéis fixos: **Newsreader** (serifa) para a camada do livro (títulos, perguntas,
citação) e **Hanken Grotesk** para a interface e os números (sempre `fontVariant: ['tabular-nums']`).

| variante | família · peso | tamanho/linha |
|---|---|---|
| `display` | Newsreader 500 | 34/38 |
| `title` | Newsreader 500 | 28/32 |
| `heading` | Newsreader 500 | 22/28 |
| `subhead` | Hanken 600 | 17/24 |
| `body` | Hanken 400 | 16/24 |
| `reading` | Newsreader 400 itálico | 17/27 |
| `callout` | Hanken 400 | 14/20 |
| `label` | Hanken 600 | 13/18 |
| `caption` | Hanken 500 | 12/16 |
| `button` | Hanken 600 | 16/20 |
| `numericXL/L/M` | Hanken 700 tabular | 40 / 28 / 20 |

Piso: nada abaixo de 12. Caixa de frase: **não existe rótulo em maiúsculas espaçadas**.
`maxFontSizeMultiplier` por variante (~1,3) para respeitar o Dynamic Type sem quebrar layout.
Pesos carregados: Newsreader 400, 400i e 500; Hanken 400, 500, 600 e 700.

### 3.3 Espaço, raio, elevação

- **Espaço:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. Gutter 20, gap de lista 12, entre seções 32.
- **Raio:** tag 6 · chip 10 · botão/input 14 · card 20 · sheet 28 · pílula 999 (só chip e XP). Capa `3 7 7 3` (lombada à esquerda).
- **Elevação:** 0 plano (lista, texto) · 1 superfície (card tocável, `surface1` + `line`) · 2 flutuante (sheet, toast: `floating` + `line2` + sombra `0 12 32 rgba(0,0,0,.4)`). A capa tem sombra própria de objeto. **Card de lista não tem sombra.**
- **Toque:** alvo mínimo de 44×44.

### 3.4 Motion e haptics

Seguem `standards/frontend/animation-patterns.md`.

| token | valor |
|---|---|
| `press` | spring, scale 0,98 + escurecer, interrompível |
| `enter` | 240 ms, ease-out, fade + translateY 8 |
| `exit` | 160 ms, ease-in (⅔ da entrada) |
| `stagger` | 40 ms, até 6 itens, só na primeira aparição |
| `count` | 600 ms, ease-out (XP e anel na conquista; única exceção acima de 500) |
| `skeleton` | crossfade 200 ms |
| telas | nativo (stack, `formSheet`, modal) |

`useReducedMotion()` reduz tudo a crossfade: sem translate, sem contagem, e o anel aparece no valor
final. Nunca `scale(0)`, loop decorativo, animação de layout ou saída mais lenta que a entrada.
Haptics: leve (aba, chip, seleção) · médio (ação primária) · sucesso (registro, conquista, nível) ·
erro (falha de envio).

### 3.5 Voz (18–24)

Pode: "pra", "tá", "bora", "mandou bem", frase curta, humor seco. Não pode: **emoji na interface**,
gíria datada ou de meme, exclamação em série, tratar o leitor como criança, travessão em copy.

| contexto | copy |
|---|---|
| saudação | "E aí, {nome}" |
| sequência | "{n} dias seguidos. Lê hoje e vira {n+1}." |
| sequência em risco | "Faltam {h}h pra sua sequência zerar. Uma página já conta." |
| capítulo fechado | "Capítulo {n}, fechado." / "Bora ver o que ficou?" |
| nota alta / baixa | "Mandou bem." / "Quase. Olha esse detalhe que passou." |
| subiu de nível | "Nível {n}. Agora você é {título}." |
| vazio | "Estante vazia, por enquanto. Escolhe o primeiro." |
| sem rede | "Caiu a internet. O que você registrou tá salvo." |

**Títulos de nível:** 1 Primeira página · 2 Curioso · 3 Engatado · 4 Constante · 5 Maratonista ·
6 Devorador · 7 Rato de biblioteca · 8+ Lenda da estante.

A microcopy honesta dos estados de erro que já existe (BER-40/42/45/66) é **preservada no
conteúdo** e reescrita no registro novo.

### 3.6 Anti-patterns

Viram checklist de revisão e, onde marcado com (T), teste automatizado.

- Hex ou `rgba` fora dos tokens (T) · `fontSize` literal fora dos tokens (T)
- `Alert.alert` fora da lista de exceção (T) · emoji em copy (T)
- `Pressable` sem `accessibilityLabel` ou `accessibilityRole` (T)
- lábio 3D (borda inferior grossa) · borda lateral de destaque em card
- sombra em card de lista · maiúsculas espaçadas como rótulo
- mascote, dragão, espada, coroa · mais de um acento por tela
- número inventado: toda métrica sai de dado persistido
- spinner de tela cheia: skeleton no formato do conteúdo
- glow, neon, gradiente roxo, glass em tudo (blur só na tab bar, se usado)

## 4. Camada de progresso (XP, nível, sequência, conquistas)

Tudo em `mobile/src/game/`, com funções puras e testadas. **Nenhum valor é inventado:** tudo é
função de dado persistido.

### 4.1 XP (`xp.ts`)

```
xp = Σ reading_sessions.pages_read × 5
   + Σ round(answers.comprehension_score / 5)   (só evaluation_status = 'completed' e score ≠ null)
   + 100 × count(student_badges)
```

As duas primeiras parcelas são a mesma fórmula que a UI de hoje já exibe (páginas × 5; nota ÷ 5),
só que somadas sobre o banco em vez de inventadas na tela. Caveat conhecido: páginas relidas
contam de novo (BER-68), igual ao `pages_read` do servidor.

### 4.2 Nível

Limiar para alcançar o nível *n*: `T(n) = 110 × n × (n − 1)`. Os valores ficam: 2 → 220 · 3 → 660 ·
4 → 1.320 · 5 → 2.200 · 6 → 3.300 · 7 → 4.620 · 8 → 6.160. A partir do 8, o título é "Lenda da
estante" e os números seguem a fórmula. A API do módulo expõe `levelFor(xp) → { level, title,
floor, next, progress }`. As constantes ficam em um lugar só, para ajustar o ritmo depois.

### 4.3 Sequência (`streak.ts`)

- **Virada de dia = fuso fixo de São Paulo**, espelhando `getTodayInSaoPaulo` do
  `register-reading-session`. O fuso do aparelho não entra.
- **Sequência efetiva:** se `last_read_date` < ontem (SP), a tela mostra 0. O `current_streak`
  do banco só é atualizado no próximo registro, então o número salvo pode estar velho.
- **Semana:** dias da semana corrente (SP) com pelo menos uma `reading_session`. Hoje sem registro
  aparece pontilhado.
- **Risco:** depois das 18h (SP), sem registro hoje e com sequência efetiva ≥ 2, a tela mostra as
  horas até 00h (SP).

### 4.4 Conquistas (`badges.ts`)

- O ícone é mapeado pelo `criteria_type` **real**: `total_sessions`, `streak_days`,
  `quizzes_answered`, `books_finished`, `reflection_score_80`, `total_pages`, `personal_book`,
  `avg_score_90_book`. Isso corrige o `BadgeGrid`, que usava chaves inexistentes.
- O progresso espelha `evaluateBadges` (`award-badges/index.ts`) nos tipos baratos de calcular:
  `total_sessions`, `streak_days` (`current_streak`), `quizzes_answered` (= respostas avaliadas),
  `books_finished` e `total_pages`. Os demais mostram só a descrição, sem barra.

## 5. Assistente ("Orelha", nome provisório)

- `src/assistant/persona.ts`: `ASSISTANT_NAME` (constante única) e o glyph (marcador âmbar com
  dois pontos, SVG).
- `src/assistant/lines.ts`: **falas templated e puras** por estado. Nada de texto gerado por IA
  fora da devolutiva que o `evaluate-answer` já devolve. Fechamentos por faixa de nota evoluem o
  `getScoreConfig`.
- **Presença:** a Hoje (só quando há assunto: quiz pendente, sequência em risco ou livro parado há
  ≥ 3 dias), o quiz (conversa), a conquista, os estados vazios e o primeiro acesso.
- **Motion do glyph:** pisca ao abrir o quiz, respira enquanto a IA avalia (substitui o spinner) e
  acena na conquista. Estático com reduce motion.

## 6. Navegação e rotas

- **Abas:** `index` (Hoje), `livros` (Estante), `catalogo` (Explorar), `perfil` (Você). **Os
  arquivos não mudam de nome**, para não quebrar deep link. Muda só o rótulo e o `TabBar` novo:
  insets reais, rótulo sempre visível, `accessibilityRole="tab"`, haptic leve e sem FAB.
- `register-reading`: `presentation: 'formSheet'`, detents `[0.7, 1]`, grabber visível. Recebe
  `bookId` opcional (BER-44 mantida).
- **Nova** `chapter-complete`: tela cheia de conquista. Params: `chapterIds`, `bookId`,
  `pagesRead`, `streak`, `xpBefore`.
- `quiz/[chapterId]` e `quiz/summary`: modal de tela cheia (`fullScreenModal`), sem tab bar.
- `reading-success`: ~~continua registrada e redireciona para `/`~~. **Corrigido em 15/09:** a rota
  foi apagada na F4 (`c23fe5f`), junto com a chegada do toast de confirmação no sheet. Nada no app
  navega mais para ela; ver o adendo no fim.
- O guard de auth do `app/_layout.tsx` fica **idêntico**. Muda só o splash (`expo-splash-screen`
  segura até as fontes carregarem, no lugar do `return null`).

## 7. Telas

Referência visual: mockups 04 e 05. Toda tela tem **loading (skeleton), vazio, erro e sucesso**
desenhados.

### 7.1 Hoje (`app/(tabs)/index.tsx`)

Ordem: saudação + anel de nível 42 (toca e vai para Você) → semana de sequência + frase →
**hero do livro em leitura** (capa 86, título serifado, "cap. X de Y · faltam N pág. pra
fechar", barra) → **CTA primário "Registrar leitura"** → card da Orelha (condicional) → linha de
nível/XP. Com 2 livros ou mais em leitura, entra a fileira "Também lendo" (capas de 48).

- "faltam N pág." = `chapter.end_page − current_page` do capítulo corrente. Precisa dos capítulos
  do livro em leitura (`getBookWithChapters`, que já existe).
- **Primeiro acesso:** a Orelha se apresenta, com CTA para Explorar e as capas do catálogo.
- **Erro:** mantém o que já carregou, com banner no topo e pull-to-refresh. Perfil com erro continua
  no `ProfileErrorState` (BER-45), redesenhado.

### 7.2 Registrar leitura (sheet)

- Linha do livro com "Trocar" (picker inline; BER-44 mantida).
- **"De" pré-preenchido com `current_page + 1`**, editável. "Até" em foco, com teclado numérico.
- Atalhos: `+10`, `+20` e **"Fim do cap. X · p. Y"** (próximo `end_page` ≥ "De").
- Resumo ao vivo: páginas, XP previsto (`páginas × 5`) e **"fecha o capítulo X"** quando o "Até"
  alcança um `end_page`.
- O aviso de páginas repetidas (BER-54, `pagesAlreadyRead`) vira nota em `accentSoft`.
- Validação idêntica (`validatePageRange`). O CTA mostra "Registrar N páginas" e fica
  desabilitado com o motivo quando inválido.
- **Resultado:**
  - com `completed_chapter_ids` → `router.replace('/chapter-complete', …)`;
  - sem capítulo fechado → o sheet fecha, sobe um toast "N páginas registradas · +X XP · N dias
    seguidos", haptic de sucesso e o `progressStore` recalcula.
  - Erro → toast de erro com "Tentar", e os campos são preservados.

### 7.3 Capítulo fechado (`app/chapter-complete.tsx`, nova)

Substitui o `Alert.alert` "Capítulo completo!".
- Conteúdo: Orelha, "Capítulo {n}, fechado.", "Bora ver o que ficou?", anel grande contando de
  `xpBefore` até o XP atual, e os chips "+X XP" e "N dias seguidos".
- Botões: **"Bora pro quiz"** (primário) e "Depois".
- Com 2 capítulos ou mais: "2 capítulos, fechados". O quiz abre pelo primeiro, e os demais ficam na
  Hoje (lógica da BER-54).
- Subiu de nível: o anel completa, zera e mostra "Nível {n}. Agora você é {título}."

### 7.4 Detalhe do livro (`app/book/[id].tsx`)

- Capa 100 + título serifado + autor + tags (gênero, páginas) + barra de progresso.
- **Lista de capítulos com estado:**
  - feito (✓ + nota média do capítulo);
  - lido com quiz pendente ("Responder");
  - lendo ("faltam N pág.");
  - trancado (`chapterGate` da BER-48: "leia até a p. X pro quiz abrir").
- A lista rola até o capítulo atual ao abrir.
- **Barra fixa "Registrar leitura"** que abre o sheet com o livro.
- Header grande que colapsa no scroll.
- A nota por capítulo vem das respostas do leitor. Ver §8 sobre a query.

### 7.5 Quiz em conversa (`app/quiz/[chapterId].tsx`)

- A máquina de estados fica **idêntica** (`quizScreenStateFor`, `pollDelayMs`, `shouldKeepPolling`,
  `loadQuizForReader`, 409/403 da BER-48). Muda só a apresentação, que vira lista de mensagens
  derivada de `questions + results + answerTexts + currentIndex + evaluating`.
- Por pergunta: bolha da Orelha com a pergunta (serifa) e rótulo "Compreensão" ou "Reflexão" →
  bolha do leitor → "digitando" enquanto avalia → bolha com a devolutiva (`feedback`) + chip
  "nota · +XP". Sem nota (BER-42): "Salvei sua resposta. A nota chega quando eu terminar de avaliar."
- Transições entre perguntas: falas templated ("Boa. Próxima.", e antes da reflexão "Agora a
  última, e essa não tem resposta certa.").
- Composer que cresce até 5 linhas, com enviar desabilitado sem texto. O teclado nunca cobre o que
  se digita.
- **Estados como falas:**
  - `polling`: "Tô relendo o capítulo {n} pra montar suas perguntas." + digitando;
  - `still-generating`: "…sua leitura já tá salva, te aviso na Hoje." + Verificar de novo;
  - `no-content`: "Ainda não tenho esse capítulo. Pergunta sem ler seria chute, e eu não chuto.";
  - `failed`: "Deu ruim do meu lado. Tenta de novo daqui a pouco."
- Quiz já respondido reabre como histórico e continua na primeira pergunta aberta.

### 7.6 Resumo (`app/quiz/summary.tsx`)

- Orelha + "Capítulo {n}, entendido." + frase por faixa, anel com média e "+XP".
- Recap por pergunta, com as pendentes como "avaliando…" e fora da média (BER-42).
- Faixa de conquista nova, se houver.
- Botões: "Continuar lendo" e "Rever a conversa".

### 7.7 Estante (`app/(tabs)/livros.tsx`)

Segmented "Lendo · N" / "Lidos · N". Em Lendo, as linhas têm capa 52, título, "cap. X de Y ·
pág." e barra. Em Lidos, uma prateleira de capas com a média do livro, quando houver. Pull-to-refresh
mantido. Vazio = estado de lombadas.

### 7.8 Explorar (`app/(tabs)/catalogo.tsx`)

- Busca por título **ou autor**, com o debounce de 300 ms mantido. Hoje o placeholder promete
  autor, mas `getBooks` só filtra `title` (ver §8).
- **Chips derivados dos gêneros reais** dos livros, o que conserta o `categoryOf`, que hoje zera a
  lista para qualquer categoria.
- Destaque = o primeiro livro, na ordem de `getBooks()` (por título), que o leitor ainda não
  começou. Se não houver nenhum, o destaque some.
- Linhas com estado: Começar / Lendo / Lido.
- "Começar" dá toast + haptic, no lugar do `Alert`, e o item muda de estado com transição.

### 7.9 Você (`app/(tabs)/perfil.tsx`)

- Anel 84 com o monograma, nome, "Nível N · título" e XP.
- Stats: sequência efetiva, páginas e média geral (só com nota).
- **Mapa de constância de 12 semanas** (`reading_sessions`, dias em SP). Substitui o gráfico de
  14 dias.
- Conquistas com progresso. Tocar abre sheet com descrição e data.
- Lista de conta: "Entrar em uma turma" (o `ClassroomGateModal` vira sheet, com a funcionalidade
  mantida) e "Sair" (destrutivo, com diálogo de confirmação).

### 7.10 Entrada (`app/(auth)/*`)

- **Login:** estante de lombadas (paleta de capas) no topo, glyph + wordmark "BeReading" em
  Newsreader, "Você lê. A gente te faz pensar sobre o que leu." Erro inline no campo, no lugar do
  `Alert`.
- **Criar conta:** "Bora começar." e indicador de quanto falta para a senha de 6. O botão continua
  desabilitado até valer (regra atual).
- **Confirmar e-mail:** o "ping" fica em âmbar e mais lento, e para com reduce motion. "Reenviar"
  ganha contador de 60 s. Os `Alert`s de status viram mensagem inline, e toda a lógica da BER-43
  continua idêntica.

### 7.11 Marca

`icon.png`, `adaptive-icon` (foreground + monochrome), `splash-icon.png` e `favicon.png` passam a
ser o marcador âmbar sobre `#12100E`. `app.json`: `userInterfaceStyle: "dark"` e splash
`backgroundColor: "#12100E"`.

## 8. Arquitetura de código

```
mobile/
  DESIGN.md
  src/theme/      tokens.ts · fonts.ts · coverPalette.ts
  src/ui/         Text · Button · IconButton · Field · PageField · Chip · Segmented
                  ProgressBar · Ring · Cover · ListRow · Skeleton · EmptyState
                  Toast (+ ToastProvider, useToast) · Banner · Screen · TabBar · Dialog
  src/game/       xp.ts · streak.ts · badges.ts
  src/assistant/  persona.ts · lines.ts · Glyph.tsx
  src/features/   home/ · register/ · chapter-complete/ · quiz-chat/ · book/ · you/ · auth/
  src/stores/     + progressStore.ts
  src/api/        queries.ts + getMyAnswers(userId) · getBooks busca também author
```

- **Primitivos:** props tipadas com `variant`, `tone`, `size` e estados `loading`, `disabled` e
  `selected`. `StyleSheet.create`, sem objeto inline por render. Pressable com feedback de spring
  (Reanimated) e haptic. `accessibilityRole` e `accessibilityLabel` obrigatórios nos tocáveis.
- **Dados:** `src/api` não muda de contrato com o servidor. São duas mudanças isoladas, só de
  leitura, feitas no cliente:
  1. **nova** `getMyAnswers(userId)`: as `answers` do próprio leitor
     (`comprehension_score, evaluation_status, question_id` + `questions(chapter_id, type)`). Ela
     alimenta o XP, a média por capítulo e a média geral. A RLS já cobre a leitura das próprias
     respostas (usada por `getStudentAnswersForChapter`).
  2. `getBooks(search)` passa a filtrar `title` **ou** `author`
     (`.or('title.ilike.%s%,author.ilike.%s%')`, com escape do termo), para cumprir o que a busca já
     promete. Assinatura igual, com teste.
- **`progressStore`** (Zustand): `sessions`, `answers`, `badges`, `streak` e o
  `snapshot { xp, level }`, com `refresh(userId)`. Hoje, Você e a conquista leem daqui. O
  `xpBefore` é capturado antes do envio do registro.
- **Feedback:** `ToastProvider` na raiz. `Alert.alert` sai de tudo, exceto confirmação destrutiva
  ("Sair"), que usa o `Dialog` do sistema. Banner de erro/sem rede derivado de falha de carga (sem
  NetInfo).
- **Capa:** `Cover` renderiza sempre a gerada. Quando há `cover_url`, o `expo-image` entra por
  cima com fade de 200 ms e `cachePolicy: 'memory-disk'`.

### 8.1 Dependências

**Entram**, todas oficiais do SDK 54 e presentes no Expo Go, instaladas via `npx expo install`:
- `@expo-google-fonts/newsreader` e `@expo-google-fonts/hanken-grotesk`;
- `expo-image`, `expo-linear-gradient` e `expo-splash-screen`.

**Corrige:** `react-native-worklets` está em 0.8.1 e o SDK 54 espera **0.5.1**. Com Reanimated em
uso, o Expo Go quebra por versão diferente entre o JS e o nativo. **É a primeira tarefa.**

**Saem (F9):** `nativewind` (0 usos; sai do babel, do metro, do `global.css` e do
`nativewind-env.d.ts`), `react-native-shadow-2` e `lottie-react-native` (junto com
`assets/lottie`, sem uso após o redesign).

## 9. Testes e verificação

- **Unidade (Jest, projeto `node`):**
  - `xp` (fórmula e níveis nas bordas) e `streak` (virada SP, efetiva, semana, risco);
  - `badges` (ícone e progresso por tipo) e `lines` (fala por estado e por faixa);
  - `coverPalette` (determinismo);
  - helpers do sheet (pré-preenchimento, atalho de fim de capítulo, "fecha o capítulo");
  - derivação das mensagens do quiz.
- **Componente (Jest, projeto `react-native`):** estados e a11y de `Button`, `Field`, `Chip`,
  `Cover` (real × gerada), `Ring` e `TabBar`. Os testes atuais de `Press3DButton`, `CustomTabBar`,
  `BookCover` e `ClassroomGateModal` são **migrados para os substitutos**. A cobertura de
  comportamento não cai (ex.: `trocar-livro`, a navegação da tab bar).
- **Guardas executáveis** (`__tests__/guards/`): hex e `fontSize` fora dos tokens, `Alert.alert`
  fora da exceção, emoji em copy e `Pressable` sem label.
- **Regressão:** os 164 testes atuais continuam verdes (ajustados só quando o componente testado é
  substituído), mais `tsc` 0 erros. `supabase/` não é tocado.
- **Visual (obrigatório por tela):** emulador Android, screenshot em 2 tamanhos (≈ 360×800 e
  ≈ 412×915), comparado com o mockup aprovado. Checar alinhamento, overflow, scroll, teclado e
  estados. iOS pelo Expo Go continua impossível (SDK 57 × 54), então fica registrado como não
  verificado.
- **Revisão de UI:** checklist `premium-ui-checklist` + audit do skill impeccable ao fim da F8.

## 10. Performance

- Motion só em `transform` e `opacity`, na thread de UI (Reanimated). Contagem com
  `useDerivedValue`.
- Listas em `FlatList`, primitivos memoizados e sem estilo inline por render.
- Fontes: só os pesos listados, e o splash segura até carregar (sem tela preta).
- Imagens: `expo-image` com cache em disco e placeholder = capa gerada.
- **Medição antes e depois:** FPS (perf monitor no emulador) no scroll da Hoje, do quiz e de
  Explorar; commits no profiler em registrar e no quiz; tamanho do bundle via `npx expo export`.
  Meta: 60 FPS no scroll e bundle igual ou menor depois da F9.

## 11. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| F2 Fundação | worklets 0.5.1 · tokens · fontes · `DESIGN.md` · `src/ui` · `src/game` · `src/assistant` · toast · guardas | testes unitários e de componente verdes; guardas rodando |
| F3 Navegação | `TabBar`, apresentações (sheet/modal), `Screen`, ícone e splash | abas e rotas navegam no emulador |
| F4 Loop central | Hoje · sheet de registro · capítulo fechado | loop completo no emulador com login real |
| ↻ | ~~rebase no `main` com a BER-48 (PR #12)~~ **merge do `main` em 15/09** (a BER-48 entrou pelos PRs #16/#17) | branch com o main integrado, testes verdes |
| F5 Fluxos | detalhe do livro · quiz em conversa · resumo | quiz completo no emulador, todos os estados vistos |
| F6 Secundárias | Estante · Explorar · Você · auth · estados de erro | todas as telas no sistema novo |
| F7 Motion | passada de motion e haptics, reduce motion | checklist de motion ok |
| F8 Refino | checklist premium · impeccable · anti-patterns | zero violação de guarda; lado a lado com a auditoria |
| F9 Performance | saem NativeWind, shadow-2 e Lottie · profiling | medições antes/depois registradas |

**Corte para demonstração:** F2 a F5 cobrem o loop que a banca veria ao vivo. A data da banca
ainda não foi informada.

Execução: tarefa por tarefa, com subagente implementador e revisão após cada uma
(`standards/ai-workflow/subagent-driven-execution.md`). Commits locais na branch. **Push e PR só
com pedido explícito.** Linear: BER-77 atualizada a cada fase.

## 12. Riscos e pontos em aberto

- **Nome do assistente:** "Orelha" é provisório, numa constante só. Decidir antes da F4.
- **Data da banca:** não informada. Define se o corte F2–F5 vira entrega intermediária.
- **`formSheet` no Android com teclado:** o `react-native-screens` suporta, mas o comportamento
  com teclado numérico precisa de prova no emulador na F3. Se falhar, a alternativa é um sheet
  próprio com Reanimated, sem dependência nova.
- **Ritmo de nível:** `T(n)` pode ficar rápido ou lento demais. Está numa constante só e se ajusta
  com uso real.
- **`end_page` nulo** (migration da BER-72): capítulo sem paginação libera o quiz e não tem
  "faltam N pág.". Nesse caso a UI esconde a meta, sem quebrar.
- **Textos de medalha do seed** com linguagem escolar: issue de conteúdo, fora desta branch.
- **iPhone:** o redesign não resolve o Expo Go do iOS. Precisa de upgrade de SDK ou build EAS, em
  issue própria.

## Adendo de 15/09: o `main` andou, e a spec se adapta a ele

Entre 14 e 15/09 o time mergeou os PRs #13 a #37. Esta branch integrou o `main` por merge, sem
reescrever histórico. O que muda nesta spec, e prevalece sobre o texto acima quando divergir:

- **Planos e cota (BER-58/61).** O plano gratuito limita livros em leitura e capítulos com quiz por
  mês; o servidor responde 402. Isto não existia quando a spec foi escrita.
  - A tela de capítulo fechado troca "Bora pro quiz" por "Conhecer o Premium" quando a cota do mês
    acabou (`src/features/chapter-complete/quizCta.ts`). É a regra que o `Alert.alert` do registro
    fazia.
  - O sheet de registro trata o 402 de livros como convite ao Premium, não como erro.
  - `planos`, `checkout`, `PaywallSheet` e `PlanCard` entram no escopo da F6. Premium não tem cor
    própria: sem coroa e sem dourado (DESIGN.md).
- **XP (BER-68).** `pages_read` guarda só as páginas novas. O XP previsto no sheet, o toast e o
  `pagesRead` da conquista seguem a mesma conta (`pages - repeatedPages`).
- **Quiz (#14 e #17).** A rota do quiz foi dividida em `QuizQuestionScreen`/`QuizMessageScreen`,
  com cadeado por página e resposta imutável. A F5 troca só a apresentação e preserva a máquina de
  estados da rota, que agora tem o estado `quota`.
- **Exclusão de conta (#20).** Entra em Você na F6, como linha destrutiva visível.
- **Escrita em `student_books`** só pela Edge Function `reading-list`. Estante e Explorar novas não
  gravam direto.
- **Dívida declarada nas guardas:** as telas do time (`planos`, `checkout`) e os `Alert.alert`
  novos de `perfil` e `book/[id]` entram nas listas de exceção até a F6.

Sequência revisada: R0 (fechar a F4) → R1 (integrar o `main`) → R2 (prova em aparelho) → R3
(`Sheet`, confirmação destrutiva, `EmptyState` com slot, regras de Premium e limite) → F5 → F6 →
F7 → F8 → F9. Registro na BER-77.
