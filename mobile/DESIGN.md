# BeReading: DESIGN.md

> Contrato de marca. Toda UI obedece este arquivo. Direção: **verde com mascote** (BER-120),
> público de 18 a 24 anos, dark-first, anti-template.
> Valores canônicos em `src/theme/tokens.ts`. Este documento explica, não duplica a fonte.
>
## 1. Color

Neutros esverdeados (tinta e mata) e **duas** cores com papel fixo. Todo valor de cor em `src/ui`,
`src/assistant` e `src/game` vem de `color` em `src/theme/tokens.ts` — as pastas que a F2 entregou,
varridas por `__tests__/guards`. `app/` e `src/features` (blocos de tela) ainda não existem em
código; entram sob guarda na F4, quando as telas forem migrando. Nada de hex, `rgb()` ou `rgba()`
literal fora de `tokens.ts` nas pastas vigiadas.

| token | valor | uso |
|---|---|---|
| `color.bg` | `#0A1310` | fundo das telas |
| `color.surface1` | `#111F1A` | cards, sheets, tab bar |
| `color.surface2` | `#192B24` | inputs, trilhas, botão secundário |
| `color.surface3` | `#23392F` | pressed / selecionado |
| `color.floating` | `#1B2C25` | toast, superfície flutuante |
| `color.line` | `rgba(246,241,228,0.08)` | divisória |
| `color.line2` | `rgba(246,241,228,0.14)` | borda de superfície flutuante |
| `color.text` | `#F6F1E4` | texto principal |
| `color.text2` | `#AFBCB2` | texto secundário |
| `color.text3` | `#9AA8A0` | legenda, desabilitado |
| `color.brand` | `#1BA36B` | **preenchimento** de leitura e ação: bloco do livro, botão primário, aba ativa |
| `color.brandInk` | `#04231A` | texto sobre `color.brand` |
| `color.brandText` | `#2FC98A` | o jade **como letra ou ícone**, sobre superfície escura |
| `color.brandSoft` | `rgba(27,163,107,0.14)` | fundo de realce de leitura |
| `color.accent` | `#F0A83A` | camada de jogo: XP, nível, sequência, conquista |
| `color.accentInk` | `#1B1206` | texto sobre `color.accent` |
| `color.accentSoft` | `rgba(240,168,58,0.14)` | aviso, chip de XP |
| `color.positive` | `#8CC28F` | sucesso |
| `color.positiveSoft` | `rgba(140,194,143,0.14)` | fundo de estado de sucesso |
| `color.danger` | `#EE7B67` | erro, destrutivo |
| `color.dangerSoft` | `rgba(238,123,103,0.14)` | fundo de estado de erro |

**Âmbar é jogo, jade é leitura e ação** (BER-120). É a mesma regra de antes — "âmbar é jogo, neutro
é leitura" — com a metade da leitura ganhando cor própria. O âmbar não mudou de valor nem de
significado: `Ring`, XP, sequência e conquista continuam exatamente onde estavam, porque a mecânica
delas também não mudou. O que ganhou tinta foi a ação: o que antes era neutro ou âmbar-de-botão
agora é jade. Duas cores por tela, cada uma com um trabalho — nunca uma terceira.

**O jade tem duas formas, e isso não é redundância.** Não existe um verde só que sirva para
preencher e para escrever. Medido em 20/09: `brand` sobre `surface3` dá **3,83**, abaixo do mínimo
de 4,5 — ele é preenchimento, e por cima dele vai `brandInk`. Para letra e ícone existe
`brandText`, a mesma família clareada (5,80 na pior superfície). Trocar um pelo outro em texto
reprova no `__tests__/theme/tokens.test.ts`, que guarda os dois lados da regra, inclusive um teste
que afirma que `brand` **deve** reprovar como texto — se alguém "simplificar" os dois num token só,
esse teste morre junto e avisa.

**Legenda é o token que mais sofre quando a base muda de tom.** O `text3` do mockup (`#84938B`)
reprovava sobre `surface3` (3,84), a mesma armadilha que o `#978E82` tinha criado na F2. Subiu para
`#9AA8A0` (mínimo 5,00). Sempre que mexer nas superfícies, confira o `text3` primeiro.

**Paleta de capas geradas** (`COVER_PALETTE_COLORS`, oito tons: `#5E2A2A` `#2F4A3A` `#22324F`
`#7A5A1E` `#4A2F4F` `#1F4A4F` `#3A3F47` `#7A3B22`), escolhida por hash determinístico do `book.id`.
O texto sobre qualquer uma delas é `COVER_INK` `#F6E9D4`, legível nas oito.

## 2. Typography

Duas famílias com papéis fixos, nunca misturados dentro do mesmo elemento: `fontFamily.display*`
(**Unbounded**) fala pelo que grita — título, número grande, wordmark; `fontFamily.ui*`
(**Bricolage Grotesque**) fala pelo que trabalha — interface, rótulo e texto corrido. Todo texto
usa uma variante de `type` (`TypeVariant` em `tokens.ts`); `fontSize` ou `fontFamily` literal fora
de `tokens.ts` não existe. As duas são SIL Open Font License 1.1.

| variante | família · peso | tamanho/linha |
|---|---|---|
| `type.display` | `fontFamily.displayHeavy` | 29/33 |
| `type.title` | `fontFamily.display` | 22/26 |
| `type.heading` | `fontFamily.uiBold` | 21/26 |
| `type.subhead` | `fontFamily.uiBold` | 17/22 |
| `type.body` | `fontFamily.uiMedium` | 16/22 |
| `type.callout` | `fontFamily.uiMedium` | 14/20 |
| `type.label` | `fontFamily.uiBold` | 13/17 |
| `type.caption` | `fontFamily.uiMedium` | 12/16 |
| `type.button` | `fontFamily.uiBold` | 16/20 |
| `type.numericXL` | `fontFamily.displayHeavy`, tabular | 40/44 |
| `type.numericL` | `fontFamily.displayHeavy`, tabular | 24/28 |
| `type.numericM` | `fontFamily.display`, tabular | 17/22 |

**Display e title encolheram, e isso não é recuo** (BER-120). Unbounded é uma face bem mais larga
que Newsreader no mesmo corpo: manter os 34 antigos estourava "Capítulo 4, fechado." em duas
linhas numa moldura de 390pt. Os valores saíram do mockup aprovado, medido em escala real.

**A serifa saiu, e com ela a variante `reading`.** Ela existia para a camada do livro ter voz
própria — pergunta de quiz, citação —, mas nenhuma tela chegou a usá-la: conferido em 20/09 com
grep em `src/` e `app/`, zero consumidores. Quem de fato falava pela serifa era o título, e título
agora é Unbounded. Carregar uma família inteira por uma variante morta era custo de rede a cada
abertura, pago em nome de um princípio que nenhuma tela exercia. `__tests__/theme/fonts.test.ts`
reprova qualquer volta de família serifada ao mapa de carga.

Piso: nada abaixo de 12 (`type.caption`, a menor variante, já está nesse piso). Números usam
sempre `fontVariant: ['tabular-nums']`, para não "pular" de largura quando contam. Caixa de frase
em tudo: não existe rótulo em maiúsculas espaçadas. Cada variante carrega seu próprio
`maxFontSizeMultiplier` (entre 1,1 e 1,4), o teto do Dynamic Type que impede o layout de quebrar
quando o usuário aumenta a fonte do sistema.

## 3. Spacing

Escala única em `space`, sempre em múltiplos de 4: `space.xs` 4 · `space.sm` 8 · `space.md` 12 ·
`space.lg` 16 · `space.gutter` 20 · `space.xl` 24 · `space.xxl` 32 · `space.xxxl` 40 · `space.huge`
48. Gutter lateral de tela é sempre `space.gutter`. Gap entre itens de uma lista é `space.md`. Gap
entre seções de uma tela é `space.xxl`.

## 4. Layout

- **Raio** (`radius`): `radius.tag` 6 para tag, `radius.chip` 10 para chip, `radius.control` 14
  para botão e input, `radius.card` 20 para card, `radius.sheet` 28 para sheet, `radius.pill` 999
  para pílula, reservado a chip e ao contador de XP. A capa usa um raio assimétrico próprio, `3 7 7
  3`, lombada à esquerda: não é um token de `radius`, é geometria do componente `Cover`.
- **Elevação** (`elevation`): `elevation.flat` (`{}`) para lista e texto correntes, sem superfície.
  `elevation.surface` (`color.surface1` + borda `color.line`) para card tocável. `elevation.floating`
  (`color.floating` + borda `color.line2` + sombra `0 12 32 rgba(0,0,0,.4)`) para sheet e toast. A
  capa tem sombra própria de objeto, fora de `elevation`. Card de lista não leva sombra: hierarquia
  vem de espaço e divisória, não de profundidade forjada.
- **Toque:** alvo mínimo `MIN_TOUCH` 44×44, com `hitSlop` `{ top: 8, bottom: 8, left: 8, right: 8
  }` quando o elemento visual é menor que isso.

## 5. Components

Os primitivos abaixo já existem em código, em `src/ui`. Este é o contrato que eles cumprem: cada
um lista seus estados. Nenhum estado aqui descrito é opcional a implementar; um primitivo sem o
estado "erro" descrito, por exemplo, ainda entra incompleto.

- **Text**: wrapper de `RNText` por `TypeVariant`. Não tem estado de interação; a única variação é
  a `TypeVariant` e a cor (`color.text`, `color.text2`, `color.text3`, `color.accent`,
  `color.danger`, conforme o contexto).
- **Button**: ação primária (`color.accent` + `color.accentInk`) e secundária
  (`color.surface2` + `color.text`). Estados: default; pressed (`motion.press`: scale 0,98,
  escurece); loading (indicador ao lado do rótulo, que continua visível, sem mudar a largura);
  disabled (`color.text3` sobre `color.surface2`, sem interação). `accessibilityRole="button"` e
  `accessibilityLabel` sempre.
- **IconButton**: mesmo contrato de estado do Button, em alvo quadrado com `MIN_TOUCH`.
  `accessibilityLabel` é obrigatório porque não há texto visível que o substitua.
- **Field**: campo de texto de uma linha. Estados: default (`color.surface2`, borda
  `color.line`); focused (borda `color.text2`, não `accent` — o acento fica reservado a
  progresso e ação primária); error (borda `color.danger` + legenda em `color.danger`, que
  **substitui** a legenda de ajuda, não convive com ela); disabled (`color.text3`).
  `accessibilityLabel` cobre o rótulo do campo.
- **PageField**: variante numérica do Field para "De"/"Até" de página. Mesmos estados do Field,
  mais um estado de valor pré-preenchido (não editado ainda) versus editado, para diferenciar o
  atalho aplicado do valor digitado.
- **Chip**: seleção de baixo compromisso (filtro, atalho de página). `radius.pill`. Estados:
  default (fundo transparente, borda `color.line2`); pressed; selected (invertido: fundo
  `color.text`, texto escuro — tinta clara com texto escuro, não `accentSoft`); disabled.
- **Tag**: rótulo **estático**, o par informativo do Chip. Usos: "+X XP" e "N dias seguidos" na
  conquista, "nota · +XP" no quiz, gênero e páginas no detalhe do livro, "Lendo agora" no hero da
  Hoje (F4, no lugar do rótulo em maiúsculas espaçadas que a tela antiga usava). `radius.tag`.
  Não tem estado de interação porque **não é tocável**, e essa é a razão de existir dele: o Chip
  exige `onPress` e se anuncia como botão, então usá-lo só para mostrar informação põe um botão
  falso na árvore de acessibilidade. Cada tom é um par fundo mais tinta, dos que já existem
  (`accentSoft`/`accent`, `positiveSoft`/`positive`, `dangerSoft`/`danger`), mais o neutro
  (`surface2` + `color.text2`). Ícone opcional à esquerda, sempre decorativo.
- **Segmented**: alternância entre poucas opções mutuamente exclusivas. Estados por segmento:
  default; pressed; selected (fundo `color.surface3`, texto `color.text`); disabled. Só um
  segmento selecionado por vez; a troca é instantânea, sem `motion.enter`.
- **Cover**: capa do livro. Capa tipográfica gerada (paleta de capas, seção 1) por padrão; capa
  real (`expo-image`) por cima quando `cover_url` existir, com crossfade de 200 ms na troca.
  Tamanhos nomeados (`size`): `xs` 48, `sm` 74, `md` 108, `lg` 160 — a altura sai sempre da
  proporção 2:3. A prop `width` (número) tem precedência sobre `size` para os tamanhos que as
  telas pedem e a tabela não cobre (52 na Estante, 86 na Hoje, 100 no detalhe do livro); o
  tamanho do título escala com `width` pela mesma proporção da tabela. Estados: loading (skeleton
  no formato da capa, nunca spinner); loaded; error (cai para a capa tipográfica gerada, nunca
  para um placeholder genérico).
- **Ring**: anel de nível. Estados: default (progresso estático até o valor atual); counting
  (`motion.count`, 600 ms, ease-out, só na conquista de nível); reduced motion (aparece direto no
  valor final, sem contagem). Pressionável quando leva a Você: nesse caso segue os estados de
  pressed do Button. Em código (F4): sem o prop `count`, é o default. Com `count` (`id`, `from`,
  `to` opcional, `onEnd`), o arco anda de `from` até `to` (padrão: `progress`) na thread de UI, por
  shared value, sem render por quadro. Trocar o `id` recomeça a contagem mesmo com os mesmos valores
  (dois trechos de 0 a 1 são dois trechos). O conteúdo central conta junto lendo a fração com
  `useRingCount()`; toda função chamada dentro dessa leitura precisa ser `'worklet'` (`xpAt`,
  `formatXp`), e o Jest não pega a falta. O leitor de tela ouve sempre `progress`, o valor final,
  nunca o intermediário. Um trecho por vez: a subida de nível (completa, zera, continua) é
  sequência de quem usa, trecho a trecho, pelo `onEnd`.
- **ProgressBar**: barra linear (progresso de capítulo, resumo de registro). Estados: default;
  updating (anima até o novo valor com `motion.count` quando o valor muda por uma ação do usuário,
  sem animar em carregamento inicial). Não existe estado "complete": em 100% o preenchimento
  continua em `color.text`, a cor de progresso de leitura (ver regra de cor da seção 1) — a barra
  não muda de cor por chegar ao fim.
- **Skeleton**: placeholder de carregamento no formato exato do conteúdo final (card, linha,
  capa), nunca um spinner de tela cheia. Único estado: loading, com crossfade `motion.skeleton`
  (200 ms) para o conteúdo real ao terminar.
- **EmptyState**: estante vazia, catálogo sem resultado, sem conquista ainda, e (R3) estados de
  tela cheia que não são vazio: erro de perfil, sucesso de checkout, estados do quiz. Composição:
  ilustração (`'spines'` por padrão; `'none'`; ou elemento próprio, como o `Glyph`), texto de voz
  (seção 7), ação primária e ação secundária opcionais (a secundária é `ghost`). Não é um erro;
  não usa `color.danger`.
- **Banner**: aviso no topo da tela (erro de rede preservando o que já carregou, aviso de
  reflexão fraca). Duas variantes, não três: `danger` (`color.dangerSoft`, texto `color.danger`) e
  `info` (`color.surface1`, texto `color.text2`). Sem dispensar automaticamente: some quando a
  causa é corrigida — e é justamente por isso que **não existe banner de sucesso**: sucesso não
  tem causa a corrigir, é transitório, e transitório é Toast.
- **ListRow**: linha de lista com divisória (`color.line`), no lugar do card do sistema legado.
  Estados: default; pressed (`color.surface3`) quando a linha é tocável; disabled; loading
  (indicador no lugar do `trailing`, `accessibilityState.busy`, sem novo toque). Tom
  `destructive` pinta o título de `color.danger` (excluir conta, sair), sempre com
  `confirmDestructive` antes da ação. Sem sombra, sem borda lateral de destaque (seção 9).
- **Card** (F4): superfície de cartão isolado, `elevation.surface` (`color.surface1` + borda
  `color.line`, `radius.card`, `space.lg` de padding interno). Estados: default; pressed
  (`motion.press`) quando tocável (`onPress` opcional; com ele, `accessibilityLabel` é
  obrigatório). Sem sombra: hierarquia vem de espaço e divisória, mesma regra do `ListRow`
  (anti-pattern, seção 9). Nasceu na Hoje (bolha do assistente), mas é vocabulário genérico —
  qualquer tela pode compor conteúdo dentro dele.
- **Toast**: confirmação transitória (registro salvo, conquista simples), via `ToastProvider`, no
  lugar de `Alert.alert`. Estados: entering (`motion.enter`); visible; exiting (`motion.exit`, ⅔
  da entrada). Não bloqueia interação por trás. No iOS a camada do toast monta dentro de
  `FullWindowOverlay` (react-native-screens), uma vez por toast: desenhado só na raiz do app, ele
  ficava atrás de sheet e modal nativos, que o iOS apresenta acima dela, e o erro com "Tentar" do
  sheet de registro não aparecia (F4-11).
- **Sheet** (R3): folha inferior modal (convite ao Premium; na F6, o que hoje é modal legado).
  `elevation.floating`, `radius.sheet` só nos cantos de cima, `space.gutter` nas laterais,
  inset inferior real. Fundo `color.scrim`. Fecha por toque fora (o scrim é um botão "Fechar"
  para leitor de tela), pelo voltar do Android e pela ação de quem usa. **Sem grabber**: esta
  folha não arrasta, e puxador que não puxa é affordance falsa. Único primitivo além do `Screen`
  que lê o inset, porque o `Modal` abre fora da árvore da tela. Sem `accessibilityViewIsModal`
  no painel: o `Modal` já isola a tela de trás, e a marca escondia o scrim do leitor de tela.
- **confirmDestructive** (R3): confirmação de ação que não se desfaz (sair, excluir conta, tirar
  da leitura, cancelar assinatura), com o diálogo do sistema. É o único `Alert.alert` permitido em
  `src/ui`. Rótulos no registro de voz: título em pergunta ("Excluir sua conta?"), mensagem que
  diz o que se perde e o que fica, ação com o verbo ("Excluir conta"), cancelar com "Cancelar" ou
  com a alternativa positiva ("Manter Premium").
- **Screen**: casca de toda tela. Pinta `color.bg`, aplica o inset superior real do aparelho e
  reserva embaixo o espaço de `TAB_BAR_HEIGHT` mais o inset inferior, para que nenhum conteúdo
  role atrás da barra. Variação por `scroll` (rolável ou fixa) e por `tabBar` (telas fora das abas
  não reservam o espaço de baixo). Não é estado: é a única forma de uma tela conhecer a borda do
  aparelho. Nenhuma tela lê `useSafeAreaInsets` por conta própria.
- **TabBar**: as quatro abas (Hoje, Estante, Explorar, Você) **mais um botão central de registrar
  leitura** (BER-120), sem entalhe em SVG. O botão saiu na F3, com a justificativa de que a ação
  viveria no contexto de cada tela — e isso deixou `app/register-reading.tsx` sem nenhum caminho no
  app inteiro, com a suíte verde (o defeito que `__tests__/guards/rotas.test.ts` documenta). Ele
  volta **somando**: o botão dentro do bloco do livro na Hoje continua. São dois caminhos para a
  ação central do produto, não um frágil. O central tem 56pt, sobe metade para fora da barra e usa
  `color.brand`; `accessibilityRole="button"`, não `tab`, para o leitor de tela continuar ouvindo
  quatro abas e não cinco. Estados por aba:
  selected (`Tone` `primary` no ícone e no rótulo, que saem do mesmo tom, nunca de duas fontes) e
  idle (`tertiary`). Tocar na aba já ativa não navega nem vibra. O rótulo vem do `title` da rota;
  o ícone é fixo por nome de rota, porque é ativo de marca e não configuração de tela. Fundo
  `color.surface1` com divisória `color.line` no topo, altura derivada de tokens mais o inset
  inferior real.
- **AssistantBubble** (BER-100): abre a câmera do assistente de leitura. Canto inferior
  **esquerdo**, acima da TabBar mais o inset inferior, sobre o conteúdo, e segue o leitor pelas
  quatro abas — é uma ação contínua, não pertence a nenhuma tela. Some quando não há livro em
  leitura, porque aí não há página para fotografar. Distingue-se do botão central de registrar
  leitura por três eixos ao mesmo tempo: lado (esquerda, não centro), tratamento (superfície
  `floating`, não preenchimento) e cor (o Glyph em `color.accent`, não `color.brand`). O toque não
  intercepta a faixa ao lado dela: a âncora é `pointerEvents="box-none"`, senão a largura toda
  acima da barra viraria área morta sobre o conteúdo.

## 6. Motion

Toda animação sai de `motion` em `tokens.ts`; não se inventa duração ou curva nova por tela.

| token | valor |
|---|---|
| `motion.press` | spring, damping 18, stiffness 320, mass 0,6, scale 0,98 |
| `motion.enter` | 240 ms, ease-out, fade + translateY 8 |
| `motion.exit` | 160 ms, ease-in (⅔ da entrada) |
| `motion.stagger` | passo de 40 ms, até 6 itens, só na primeira aparição |
| `motion.count` | 600 ms, ease-out (XP e anel na conquista; única exceção acima de 500 ms) |
| `motion.skeleton` | crossfade de 200 ms |

Transição de tela é nativa (stack, `formSheet`, modal do expo-router), nunca reimplementada.
`useReducedMotion()` reduz tudo a crossfade: sem translate, sem contagem, o anel aparece direto no
valor final. Proibido: `scale(0)`, loop decorativo, animação de layout e saída mais lenta que a
entrada. Haptics: leve para navegação (aba, chip, seleção), médio para ação primária, sucesso para
registro, conquista e nível, erro para falha de envio.

## 7. Voice

Público de 18 a 24 anos. Pode: "pra", "tá", "bora", "mandou bem", frase curta, humor seco. Não
pode: emoji na interface, gíria datada ou de meme, exclamação em série, tratar o leitor como
criança, travessão em copy.

| contexto | copy |
|---|---|
| saudação | "E aí, {nome}" |
| sequência | "{n} dias seguidos. Lê hoje e vira {n+1}." |
| sequência, já leu hoje | "{n} dias seguidos. Hoje já conta, amanhã vira {n+1}." |
| sequência em risco | "Faltam {h}h pra sua sequência zerar. Uma página já conta." |
| livro parado (F4) | "Faz {n} dias que você não abre o livro. Uma página já reata." |
| capítulo fechado | "Capítulo {n}, fechado." / "Bora ver o que ficou?" |
| nota alta / baixa | "Mandou bem." / "Quase. Olha esse detalhe que passou." |
| subiu de nível | "Nível {n}. Agora você é {título}." |
| vazio | "Estante vazia, por enquanto. Escolhe o primeiro." |
| sem rede | "Caiu a internet. O que você registrou tá salvo." |
| limite atingido | título de `paywallCopy` + "Conhecer o Premium" / "Agora não" |
| quiz do mês acabou | "{título}. Seus quizzes voltam em {data}." |
| cancelar assinatura | "Cancelar assinatura?" / "Manter Premium" |
| excluir conta | "Excluir sua conta?" / "Excluir conta" |

**Títulos de nível:** 1 Primeira página, 2 Curioso, 3 Engatado, 4 Constante, 5 Maratonista,
6 Devorador, 7 Rato de biblioteca, 8+ Lenda da estante.

A microcopy honesta dos estados de erro que já existe é preservada no conteúdo e só ganha o
registro de voz novo. Nenhuma copy inventa um número: toda métrica citada vem de dado persistido
(XP, sequência, páginas, nota).

## 8. Brand

**Essência:** BeReading trata a leitura como hábito que se constrói, não como tarefa escolar. A
interface fala como alguém que também lê e não acha isso um sacrifício.

**Direção:** verde com mascote (BER-120). Fundo escuro esverdeado (`color.bg`), creme para o
texto, jade para leitura e ação, âmbar para a camada de jogo. Unbounded no que grita, Bricolage
Grotesque no que trabalha.

**Referências de acabamento:** Spotify Wrapped e BookTok continuam valendo pelo registro jovem sem
infantilizar. **O "explicitamente não Duolingo" caiu em 20/09/2026**, por decisão de grupo: a visão
fundadora do produto cita Duolingo como inspiração em cinco documentos, e a regra anterior foi
escrita sem acesso a eles. O que não volta é o **tom de aplicativo escolar** — o produto é B2C e
saiu da escola em 31/08/2026 (BER-52).

**Sentimento alvo:** que o app pareça feito à mão e com humor, não um template genérico de
gamificação. Métrica real, nunca inflada. O mascote é simpático, a interface não grita: quem faz a
festa é ele, não o efeito.

**A marca tem três peças, e cada uma existe por um limite de tamanho.** Não é redundância: é a
mesma forma resolvida para escalas em que as outras não funcionam.

- **`src/assistant/Mascote.tsx`** (BER-120) é a ilustração — um macaco de moletom, óculos escuros
  e livro, recortado como adesivo. É quem o leitor reconhece. Aparece onde há espaço: a bolha do
  assistente na Hoje e a tela de capítulo fechado. `size` é um **conjunto nomeado**
  (`sm` 96 · `md` 134 · `lg` 178), nunca um número: abaixo de ~80pt o desenho vira borrão, e um
  prop numérico deixaria alguém escrever `size={20}` e só descobrir no aparelho.
- **`src/assistant/Glyph.tsx`** continua sendo a marca pequena — marcador de página com dois
  olhos, em `color.brandText`. É o que diz "quem está falando" ao lado de um rótulo, nos nove
  lugares onde roda a 20, 28 e 40px. **O mascote não o substitui**, porque nesse tamanho a
  ilustração não lê.
- **`assets/brand/icon-mark.svg`**, nos ícones de sistema (app, splash, favicon), **não tem olhos**
  e é cerca de 15% mais estreito. Descoberto na F3, gerando o ícone a 1024px: em tamanho grande os
  dois pontos sobre a forma larga param de ler como marcador e viram cara.

A simetria vale a pena notar: o `icon-mark` nasceu porque a forma **grande demais** deixava de
funcionar, e o `Glyph` sobrevive à BER-120 porque a ilustração **pequena demais** deixa de
funcionar. É o mesmo problema nas duas pontas.

⚠️ **O arquivo do mascote é imagem gerada por IA e a licença comercial do gerador ainda não foi
conferida.** Este repositório é público. Antes de qualquer publicação em loja, a licença precisa
ser verificada, e o arquivo trocado por um asset com origem conhecida se não estiver liberada.

O SVG-fonte do glyph e do ícone fica em `assets/brand/`, e os PNGs saem dele. PNG de ícone não se
edita à mão: regenera-se do SVG.

## 9. Anti-patterns

Checklist de revisão. **(T)** marca o item coberto por teste automatizado na Tarefa 17.

- Cor literal (hex, `rgb()` ou `rgba()`) fora de `tokens.ts` em `src/ui`, `src/assistant` ou
  `src/game` (T) — `app/` e `src/features` entram sob guarda na F4
- `fontSize` ou `fontFamily` literal fora de `tokens.ts` (T)
- `Alert.alert` fora da lista de exceção (T)
- Emoji em copy de interface (T)
- Travessão, o caractere de em dash ou de en dash, **em texto que chega na tela**: string e copy
  (T). **Comentário pode ter** — e essa exceção é deliberada, não frouxidão. A guarda filtra
  comentário porque a razão de banir o travessão é que ele marca texto de máquina em copy de
  produto, e comentário não é copy. Antes disso a guarda lia o arquivo cru, e o resultado foi
  comentário sendo reescrito pior só para passar num grep (ADR 0010, corolário): quando uma
  restrição empurra o remendo para o lugar errado, quem cede é a restrição.
- `Pressable` sem `accessibilityRole` ou sem `accessibilityLabel` (T)
- Lábio 3D (borda inferior grossa)
- Borda lateral de destaque em card
- Sombra em card de lista
- Maiúsculas espaçadas como rótulo
- Dragão, espada, coroa (T: coroa, `__tests__/guards/brand.test.ts`). **Mascote saiu desta lista
  na BER-120** — a guarda nunca chegou a cobri-lo, só a coroa
- Mais de um acento por tela
- Número inventado: toda métrica sai de dado persistido
- Spinner de tela cheia: o carregamento usa skeleton no formato do conteúdo
- Glow, neon, gradiente roxo, glass em tudo (blur só na tab bar, se usado)

## 10. Premium e limite

O plano gratuito limita quantidade (livros em leitura, capítulos com quiz por mês); o hábito
(registro, sequência, conquistas) é igual nos dois planos. A interface trata isso assim:

- **Premium não tem cor própria.** Sem coroa, sem dourado. Quando precisar marcar, `Tag` neutra
  ou `accent` com "Premium". Preço em `numericL` com `color.text`. O âmbar continua sendo só a
  ação primária da tela.
- **Limite nunca aparece no anel nem no XP.** Nada de "XP bloqueado" nem nível travado: o limite
  é de uso, não de progresso.
- **Uso da cota é texto, nunca barra.** "1 de 2 livros em leitura", "3 de 4 quizzes este mês".
  `ProgressBar` fica para progresso de leitura, e usá-la para cota gamifica o limite.
- **Limite atingido é convite, não erro.** `PaywallSheet` (`Sheet` + copy de `paywallCopy`), sem
  `color.danger`, sempre com "Agora não". Onde a ação principal da tela depende da cota (o quiz
  na conquista), o CTA troca para "Conhecer o Premium" com a fala de quando a cota volta.
- **"Premium" não entra em nome de componente nem de token.** O plano é produto; "premium" como
  qualidade visual é o redesign inteiro, e misturar os dois confunde quem lê o código.
- **A cobrança é simulada** (`billing-mock`, BER-79). A interface não afirma cobrança real que não
  acontece, mas o aviso de demonstração no checkout é decisão do time (BER-61) e não se muda aqui.
