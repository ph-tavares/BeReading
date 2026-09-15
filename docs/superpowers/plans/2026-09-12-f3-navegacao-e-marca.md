# F3 Navegação e marca — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`. Passos com checkbox (`- [ ]`).

**Objetivo:** trocar a estrutura de navegação e a marca do app. Ao fim desta fase o app **abre diferente** — ícone, splash, tab bar e apresentação de telas —, mas o conteúdo das telas ainda é o antigo.

**Arquitetura:** os arquivos de rota não mudam de nome, para não quebrar deep link. Muda o `TabBar`, a apresentação de cada rota, e os assets de marca.

**Stack:** Expo 54 · React Native 0.81 · TypeScript strict · expo-router 6 · Reanimated 4

**Spec:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-design.md` (§6 navegação, §7.11 marca)

**Fase:** F3 de 9. A F2 (fundação) está em `d199d9f`.

## Diferença de método em relação à F2

O plano da F2 trazia o código literal de cada tarefa, e **cinco defeitos vieram desse código**. Agora os primitivos existem, estão testados e documentados no `DESIGN.md`. Este plano descreve **o que construir, com quais peças e qual o critério de aceite**. Onde o código for a única forma de ser preciso, ele aparece; no resto, não.

Consequência para quem executa: você tem liberdade de implementação **dentro do contrato**. Se o critério de aceite não puder ser cumprido com os primitivos existentes, **pare e relate** em vez de inventar peça nova.

## Restrições globais

- **Branch:** `feature/premium-ui-redesign`. Comandos a partir de `mobile/`.
- **Sem push e sem PR.** Commits locais.
- **Nada em `supabase/`, `src/api/` ou regra de negócio.**
- **O guard de autenticação do `app/_layout.tsx` é intocável.**
- **Baseline: 526 testes / 39 suítes**, `tsc` 0 erros. Só cresce.
- **Tudo vem de `src/theme/tokens.ts`.** As guardas de `__tests__/guards/` reprovam literal.
- **Todo tocável com `accessibilityRole` e `accessibilityLabel`.** Alvo ≥ 44.
- **Copy:** pt-BR, 18 a 24 anos, sem emoji, sem travessão. Ver `DESIGN.md` §Voice.
- Commits: `<tipo>(BER-77): <o que muda>`, com `Co-Authored-By` da sessão que escreveu.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/assistant/Glyph.tsx` | o marcador âmbar em SVG, tamanho configurável |
| `src/ui/Screen.tsx` | casca de tela: fundo, safe area e cabeçalho opcional |
| `src/ui/TabBar.tsx` | a barra de abas nova |
| `app/(tabs)/_layout.tsx` | liga o `TabBar` e renomeia os rótulos |
| `app/_layout.tsx` | apresentação das rotas (sheet, modal) e a rota nova |
| `app/chapter-complete.tsx` | rota nova, placeholder nesta fase |
| `app/reading-success.tsx` | passa a redirecionar |
| `assets/*` | ícone, splash e favicon novos |
| `app.json` | aponta para os assets novos |

---

## Tarefa 1: `Glyph`, o marcador do assistente

**Por quê:** é a marca do produto e a cara do assistente. Ele é a mesma forma do ícone do app, então precisa existir como componente antes de virar PNG. A F2 deixou essa lacuna (o plano listava o arquivo e nenhuma tarefa o criava).

**Arquivos:** cria `src/ui/Glyph.tsx` (ou `src/assistant/Glyph.tsx`, escolha e justifique), `__tests__/ui/Glyph.test.tsx`; modifica `src/ui/index.ts`.

**Interfaces produzidas:** `<Glyph size={n} />`, padrão 20, proporção 3:4, `testID="glyph"`.

**Forma:** um marcador de página (retângulo com entalhe em V na base) em `color.accent`, com dois pontos redondos em `color.accentInk` na parte de cima, que dão a leitura de olhar. É o desenho que já aparece nos mockups aprovados: `M2 4.5A4.5 4.5 0 0 1 6.5 0h11A4.5 4.5 0 0 1 22 4.5V30l-10-6.5L2 30Z` num `viewBox="0 0 24 32"`, com círculos em `(8.6, 10)` e `(15.4, 10)`, raio 1.7.

**Critério de aceite:**
- [ ] Renderiza em qualquer `size` mantendo a proporção 3:4.
- [ ] Usa `react-native-svg`, que já é dependência.
- [ ] Cores vêm dos tokens, nunca literais.
- [ ] É decorativo: `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`, porque quem lê tela não ganha nada ouvindo "imagem". Quando ele acompanhar texto, o texto é que carrega o significado.
- [ ] Teste cobre: proporção em dois tamanhos, e que é escondido do leitor de tela.

---

## Tarefa 2: `Screen`, a casca de tela

**Por quê:** hoje cada tela repete `paddingTop: insets.top + 8`, `backgroundColor` e o mesmo cabeçalho à mão. O `TopBar` antigo usa `paddingTop: 58` fixo, que quebra em aparelho com notch diferente.

**Arquivos:** cria `src/ui/Screen.tsx`, `__tests__/ui/Screen.test.tsx`; modifica `src/ui/index.ts`.

**Interfaces produzidas:**
```ts
<Screen
  title?: string              // cabeçalho grande, em Newsreader
  subtitle?: string
  onBack?: () => void         // mostra o botão voltar
  headerRight?: React.ReactNode
  scroll?: boolean            // default true
  refreshing?: boolean; onRefresh?: () => void
  contentStyle?: ViewStyle
  edges?: ('top' | 'bottom')[]  // default ['top']
>
```

**Critério de aceite:**
- [ ] Usa **insets reais** de `useSafeAreaInsets`, nunca número fixo.
- [ ] Fundo `color.bg`, gutter lateral `space.gutter`.
- [ ] Com `scroll`, usa `ScrollView` com `showsVerticalScrollIndicator={false}` e reserva no fim espaço suficiente para a tab bar não cobrir conteúdo. **Esse espaço vem de uma constante exportada pelo `TabBar` (Tarefa 3), não de número solto.**
- [ ] Com `onRefresh`, monta o `RefreshControl` com `tintColor` do token.
- [ ] O botão voltar é um `IconButton` com label "Voltar".
- [ ] Teste: insets são respeitados; sem `onBack` não há botão; `onRefresh` ausente não monta `RefreshControl`; título e subtítulo aparecem.

---

## Tarefa 3: `TabBar`

**Por quê:** a barra atual tem notch em SVG, botão flutuante central e **faixa de safe area fixa em 28px**, que erra em qualquer aparelho fora desse valor. A ação principal sai da barra e vai para o contexto (decisão D5 da spec).

**Arquivos:** cria `src/ui/TabBar.tsx`, `__tests__/ui/TabBar.test.tsx`; modifica `src/ui/index.ts`.

**Interfaces produzidas:** `<TabBar {...BottomTabBarProps} />` e a constante `TAB_BAR_HEIGHT`, que o `Screen` consome.

**Critério de aceite:**
- [ ] Quatro abas: Hoje, Estante, Explorar, Você. **Sem FAB.**
- [ ] Ícone e rótulo sempre visíveis; o ativo em `color.text`, o inativo em `color.text3`.
- [ ] Altura da barra mais `insets.bottom` **reais**.
- [ ] Cada aba: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, label com o nome da aba, alvo ≥ 44.
- [ ] Haptic leve na troca de aba, e **nenhum** haptic ao tocar na aba já ativa.
- [ ] Ícones desenhados com `react-native-svg`, no mesmo peso de traço. Não usar `lucide-react-native` aqui: a barra é o elemento mais visto do app e precisa de traço consistente com o `Glyph`.
- [ ] Teste: navega ao tocar; não navega nem vibra na aba ativa; os quatro rótulos existem; `TAB_BAR_HEIGHT` é maior que `MIN_TOUCH`.

**Atenção:** o `src/components/CustomTabBar.tsx` **continua existindo** até a F6. Não o apague.

---

## Tarefa 4: ligar a navegação

**Por quê:** é o que faz a estrutura nova valer. Sem isso, os componentes das tarefas 2 e 3 existem e ninguém usa.

**Arquivos:** modifica `app/(tabs)/_layout.tsx`, `app/_layout.tsx`; cria `app/chapter-complete.tsx`; modifica `app/reading-success.tsx`.

**Critério de aceite:**
- [ ] `app/(tabs)/_layout.tsx` usa o `TabBar` novo e os rótulos passam a ser Hoje, Estante, Explorar e Você. **Os nomes de arquivo de rota não mudam.**
- [ ] `register-reading` ganha `presentation: 'formSheet'`, `sheetAllowedDetents: [0.7, 1]`, `sheetGrabberVisible: true`.
- [ ] `quiz/[chapterId]` e `quiz/summary` ganham `presentation: 'fullScreenModal'`.
- [ ] Rota nova `chapter-complete`, também `fullScreenModal`. **Nesta fase ela é placeholder**: recebe os params (`chapterIds`, `bookId`, `pagesRead`, `streak`, `xpBefore`), mostra o título com o `Glyph` e um botão que volta. O conteúdo real é F4.
- [ ] `reading-success` passa a redirecionar para `/` no lugar de renderizar. A rota continua registrada, para não quebrar link antigo.
- [ ] O guard de autenticação e a lógica de splash saem **byte a byte iguais**.
- [ ] Teste: a árvore de rotas declara as apresentações esperadas; `reading-success` redireciona.

**Risco conhecido, registrado na spec §12:** o `formSheet` no Android com teclado numérico precisa de prova em aparelho. Ele não bloqueia esta tarefa, mas **entra na checklist de emulador da F4**, junto do comportamento de colar no `PageField`.

---

## Tarefa 5: os assets de marca

**Por quê:** hoje o ícone do app é **o padrão do Expo** e o splash é branco num app escuro. É o achado mais visível da auditoria e o primeiro contato de quem instala.

**Arquivos:** substitui `assets/icon.png`, `assets/splash-icon.png`, `assets/favicon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`, `assets/android-icon-background.png`; modifica `app.json`.

**Como gerar:** escreva um SVG do marcador (a mesma forma do `Glyph`) e converta para PNG. O Chrome headless está disponível em `C:\Program Files\Google\Chrome\Application\chrome.exe` e resolve com `--screenshot` e `--window-size`, com fundo transparente onde precisar. Guarde o SVG-fonte em `assets/brand/` para poder regerar.

**Critério de aceite:**
- [ ] `icon.png` 1024×1024: marcador âmbar centralizado sobre `#12100E`, com margem de respiro.
- [ ] `android-icon-foreground.png` 1024×1024 **transparente**, com o marcador dentro da zona segura (o Android corta as bordas em máscaras redondas: mantenha o desenho dentro dos 66% centrais).
- [ ] `android-icon-background.png` 1024×1024 sólido `#12100E`.
- [ ] `android-icon-monochrome.png` 1024×1024: silhueta branca sobre transparente.
- [ ] `splash-icon.png` 512×512 transparente.
- [ ] `favicon.png` 64×64.
- [ ] `app.json`: `splash.backgroundColor` e `adaptiveIcon.backgroundColor` em `#12100E` (já estão), e o `adaptiveIcon.backgroundImage` **removido ou substituído** — hoje ele aponta para a arte antiga e sobrepõe a cor, então o ícone continuaria o velho.
- [ ] Cada PNG conferido: abra e olhe. Ícone cortado ou desalinhado é o tipo de defeito que só aparece assim.

---

## Ao fim da F3

- [ ] `npx jest --silent` e `npx tsc --noEmit` verdes.
- [ ] **Prova no emulador**, obrigatória nesta fase: suba o app, navegue entre as quatro abas, abra o registro de leitura (confirme que vem como sheet), abra um quiz (confirme que vem como modal sem tab bar) e veja o ícone e o splash novos. Guarde captura de cada um.
- [ ] Comentar na `BER-77` o que a fase entregou.

## Autorrevisão deste plano

**Cobertura:** spec §6 → Tarefas 3 e 4 · §7.11 → Tarefa 5 · lacuna do `Glyph` (Ruling F16 da F2) → Tarefa 1 · dívida do `TAB_BAR_CLEARANCE` → Tarefa 3, via `TAB_BAR_HEIGHT`.

**Fora desta fase, por desenho:** o conteúdo das telas (F4 a F6); a extensão das guardas para `app/` e `src/features`, que é a **primeira tarefa da F4**, porque é lá que nasce tela nova; o primitivo `Dialog` (F6); a remoção do `CustomTabBar` e dos componentes legados (F6).

**Risco assumido:** ao fim desta fase o app tem navegação e marca novas com **conteúdo de tela antigo**, e as telas antigas seguem no fallback de fonte. A mistura é feia de propósito e some na F6. A prova no emulador vai mostrar isso; não é regressão.
