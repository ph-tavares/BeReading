# F5 · Livro, quiz em conversa e resumo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrar as três telas do fluxo de leitura e compreensão (detalhe do livro, quiz, resumo) para o sistema novo, com o quiz virando conversa com a Orelha, **sem mudar a lógica do time** (cota BER-58, resposta imutável e trava BER-48, polling BER-40/66).

**Architecture:** Lógica pura em `src/features/<tela>/logic.ts` (testada contra o módulo real); composição em `src/features/quiz-chat` e `src/features/book`; as rotas em `app/` trocam só a apresentação. Os componentes legados `QuizQuestionScreen` e `QuizMessageScreen` ficam no repositório, sem uso, até a F9 (são do time e têm testes próprios).

**Tech Stack:** Expo 54 · expo-router 6 · TypeScript strict · Jest (jest-expo) · @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-design.md` §5, §7.4, §7.5, §7.6 e o adendo de 15/09; `mobile/DESIGN.md` §5, §7, §10.

## Global Constraints

- Tudo das Global Constraints da R3 (`docs/superpowers/plans/2026-09-15-r3-sistema.md`): tokens, voz, a11y, sem coroa, commit por tarefa em PT-BR sem `Co-Authored-By`, `tsc` 0 e `jest` verde por tarefa.
- A máquina de estados da rota do quiz fica **idêntica**: `quizScreenStateFor`, `pollDelayMs`, `shouldKeepPolling`, `loadQuizForReader`, 409 (`alreadyAnswered`), 402 (`quota`), `reloadKey` ao voltar dos planos.
- Detalhe do livro mantém `chapterLockState` (BER-48), página nula liberando (BER-72), `startReadingBook`/`stopReadingBook` com `PaywallSheet` no 402 (BER-58).
- Nenhuma copy inventa número: nota e XP saem das respostas persistidas (BER-42: sem nota não é zero).
- Rota nova de navegação sempre literal (`pathname: '/…'` ou `router.push('/…')`), por causa de `__tests__/guards/rotas.test.ts`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| Modify `mobile/src/assistant/lines.ts` | `quizStateLine('quota')`, `quizTransitionLine`, `chapterUnderstoodTitle` |
| Create `mobile/src/features/quiz-chat/logic.ts` | `buildConversation`, `answeredXp`, `scoreTagLabel` |
| Create `mobile/src/features/quiz-chat/ChatBubble.tsx` | Bolha da Orelha, do leitor, "digitando" e devolutiva |
| Create `mobile/src/features/quiz-chat/Composer.tsx` | Campo que cresce até 5 linhas + Enviar |
| Create `mobile/src/features/quiz-chat/QuizConversation.tsx` | Tela da conversa (substitui `QuizQuestionScreen` na rota) |
| Create `mobile/src/features/quiz-chat/AssistantStateView.tsx` | Estados polling/still-generating/no-content/failed/quota como fala |
| Create `mobile/src/features/quiz-chat/index.ts` | Exports |
| Modify `mobile/app/quiz/[chapterId].tsx` | Troca a apresentação; passa `chapterId` ao resumo; erro de avaliação vira toast |
| Modify `mobile/app/quiz/summary.tsx` | Resumo honesto: Orelha, média no anel, XP real, recap, "Rever a conversa" |
| Create `mobile/src/features/book/logic.ts` | `chapterStates`, `averageByChapter` |
| Create `mobile/src/features/book/ChapterRow.tsx` | Linha de capítulo por estado |
| Create `mobile/src/features/book/index.ts` | Exports |
| Modify `mobile/app/book/[id].tsx` | Detalhe do livro no sistema novo, com barra fixa "Registrar leitura" |
| Modify `mobile/__tests__/guards/{designTokens,copy,a11y,brand}.test.ts` | Tiram as exceções das três telas |

---

### Task 1: Falas do quiz e do resumo

**Interfaces — Produces:**
- `type QuizStateKey = 'polling' | 'still-generating' | 'no-content' | 'failed' | 'quota'`
- `quizTransitionLine(nextType: 'comprehension' | 'reflection', isLast: boolean): string`
- `chapterUnderstoodTitle(chapterNumber: number | null): string`

**Tests (`__tests__/assistant/lines.test.ts`):**
- `quizStateLine('quota', 3)` → `{ text: 'Seus quizzes do mês acabaram. Sua leitura continua valendo.', cta: 'Conhecer o Premium' }`
- `quizTransitionLine('comprehension', false)` → `'Boa. Próxima.'`
- `quizTransitionLine('reflection', true)` → `'Agora a última, e essa não tem resposta certa.'`
- `quizTransitionLine('reflection', false)` → `'Agora uma de reflexão. Essa não tem resposta certa.'`
- `chapterUnderstoodTitle(4)` → `'Capítulo 4, entendido.'`; `chapterUnderstoodTitle(null)` → `'Quiz fechado.'`
- As novas entram em `TODAS` e na lista de exports (contrato de voz).

- [ ] Teste vermelho → implementação → verde → commit `feat(BER-77): falas do quiz em conversa e do resumo`

---

### Task 2: Lógica da conversa

**Interfaces — Produces (`src/features/quiz-chat/logic.ts`):**

```ts
export type ChatMessage =
  | { id: string; kind: 'assistant'; text: string; label?: string; serif?: boolean }
  | { id: string; kind: 'reader'; text: string }
  | { id: string; kind: 'typing' }
  | { id: string; kind: 'feedback'; text: string; tag: string | null };

export interface ConversationInput {
  questions: Pick<Question, 'type' | 'question_text'>[];
  results: Record<number, QuestionResult>;
  answerTexts: Record<number, string>;
  currentIndex: number;
  evaluating: boolean;
  /** O que o leitor acabou de enviar e a IA ainda avalia. */
  pendingAnswer: string;
}

export function buildConversation(input: ConversationInput): ChatMessage[];
export function scoreTagLabel(score: number): string;        // "72 · +14 XP"
export function answeredXp(results: QuestionResult[]): number; // soma de round(score / 5) só das avaliadas
```

**Regras (testadas):**
- Mostra as perguntas de `0` até `max(currentIndex, maior índice respondido)`: quiz reaberto aparece como histórico.
- Antes de cada pergunta `i > 0`: fala `quizTransitionLine(tipo, i === última)`.
- Pergunta: `assistant` com `serif: true` e `label` "Compreensão" ou "Reflexão".
- Respondida: `reader` com `answerTexts[i]` e `feedback` com `result.feedback` e `tag = scoreTagLabel(score)`; sem nota (BER-42): `feedback` com `scoreLine(null)` e `tag: null`.
- Pergunta atual avaliando e ainda sem resultado: `reader` com `pendingAnswer` e `typing`.
- `answeredXp` ignora `score: null`. `scoreTagLabel(72)` = `'72 · +14 XP'`.

- [ ] Teste vermelho → implementação → verde → commit `feat(BER-77): lógica pura da conversa do quiz`

---

### Task 3: Componentes da conversa

**Interfaces — Produces:**
- `ChatBubble({ message: ChatMessage })`
- `Composer({ value, onChangeText, onSend, sending })`: `TextInput` multiline com altura máxima de 5 linhas de `type.body`, `accessibilityLabel="Sua resposta"`, `Button` "Enviar" desabilitado sem texto e com `loading` enquanto avalia.
- `QuizConversation({ questions, currentIndex, results, answerTexts, answer, onChangeAnswer, evaluating, onSubmit, onNext, onBack })`: `Screen` sem scroll, bordas topo e base, `onBack`, título "Quiz" e subtítulo "Pergunta {i+1} de {n}"; `ScrollView` com as mensagens rolando para o fim; rodapé com `Composer` (pergunta aberta) ou `Button` "Próxima" / "Ver resumo" (respondida).

**Tests (`__tests__/features/quiz-chat/QuizConversation.test.tsx`):** mostra a pergunta e o rótulo; Enviar desabilitado sem texto e dispara `onSubmit` com texto; respondida mostra devolutiva, tag de nota e "Próxima"; última pergunta mostra "Ver resumo"; sem nota mostra "Salvei sua resposta…"; avaliando mostra o indicador de digitando.

- [ ] Teste vermelho → implementação → verde (inclui guardas) → commit `feat(BER-77): conversa do quiz com bolhas e composer`

---

### Task 4: Estados do quiz como fala

**Interfaces — Produces:**
- `AssistantStateView({ state: QuizStateKey; chapterNumber: number | null; detail: string; onPrimary?: () => void; onBack: () => void })`, sobre `EmptyState` com `illustration={<Glyph size={40} />}`, título = `quizStateLine(state).text`, descrição = `detail`.
- Ações: polling → secundária "Responder depois"; still-generating → "Verificar de novo" + "Responder depois"; no-content → "Voltar pro livro"; failed → "Tentar de novo" + "Voltar"; quota → "Conhecer o Premium" + "Voltar".

**Tests (`__tests__/features/quiz-chat/AssistantStateView.test.tsx`):** um caso por estado, conferindo fala, botões e callbacks.

- [ ] Teste vermelho → implementação → verde → commit `feat(BER-77): estados do quiz ditos pela Orelha`

---

### Task 5: Rota do quiz no sistema novo

**Files:** `mobile/app/quiz/[chapterId].tsx`; guardas.

- Mesmos `useState`/`useEffect`/`handleSubmit`/`handleNext` (sem mudar condição nem chamada).
- `loading` → `Screen` com `Skeleton` no formato da conversa.
- `quota` → `AssistantStateView state="quota"` com `detail` = `paywallCopy(quota)` (descrição + dica); primária `router.push('/planos')`.
- polling/still-generating/no-content/failed → `AssistantStateView` (failed "Tentar de novo" = `setReloadKey(k => k + 1)`).
- `ready` → `QuizConversation`.
- Erro de avaliação: `toast.show({ message: 'Não deu pra enviar sua resposta.', detail: 'O que você escreveu continua aqui.', tone: 'danger' })` no lugar de `Alert.alert`.
- `handleNext` passa `chapterId` também para `/quiz/summary`.
- Guardas: `app/quiz/[chapterId].tsx` sai de `EXCECAO_COR`, `EXCECAO_FEEDBACK`, `EXCECAO_EMOJI`, `EXCECAO_TRAVESSAO`, `EXCECAO_A11Y` e `EXCECAO_COROA` (os tripwires reprovam se ficar).

- [ ] `tsc` + `jest` completos verdes → commit `feat(BER-77): quiz vira conversa, com a máquina de estados do time intacta`

---

### Task 6: Resumo honesto

**Files:** `mobile/app/quiz/summary.tsx`; guardas.

- Params: `avgScore`, `total`, `pending` (contrato do time) + `chapterId` (novo, opcional).
- Com `chapterId`: carrega `getChaptersByIds([chapterId])` (número) e `loadQuizForReader(chapterId, userId)` (recap). Falha em qualquer um: segue sem recap e com título sem número.
- Conteúdo: Orelha; `chapterUnderstoodTitle(n)`; `scoreLine(média ou null)`; `Ring` 112 com a média (ou "avaliando" no centro); `Tag` `+{answeredXp} XP` (soma real, não média × total); frase de pendentes (BER-42); recap em `ListRow` por pergunta com `Tag` da nota ou "avaliando".
- Botões: "Continuar lendo" → `router.replace('/')`; "Rever a conversa" → `router.replace(`/quiz/${chapterId}`)` (só com `chapterId`).
- Sai: confete, "QUEST COMPLETA", "Continuar a saga", "Feedback do mestre", `getScoreConfig` (continua existindo em `src/utils`, com o teste do time).
- Guardas: `app/quiz/summary.tsx` sai das exceções de cor e travessão.

- [ ] Teste de tela (`__tests__/screens/quizSummary.test.tsx`: média, pendentes, XP real, recap, botões) vermelho → implementação → verde → commit `feat(BER-77): resumo do quiz honesto e no sistema novo`

---

### Task 7: Detalhe do livro

**Interfaces — Produces (`src/features/book/logic.ts`):**

```ts
export type ChapterState =
  | { kind: 'done'; average: number | null }
  | { kind: 'quiz' }
  | { kind: 'reading'; pagesLeft: number }
  | { kind: 'locked'; endPage: number }
  | { kind: 'open' };

export function chapterStates(
  chapters: Pick<Chapter, 'id' | 'number' | 'end_page'>[],
  currentPage: number | null,
  answeredByChapter: Record<string, (number | null)[]>,
): Record<string, ChapterState>;
```

**Regras (testadas):** página atual desconhecida → `open` (servidor ainda trava com 403); `end_page` nulo → `done` se respondido, senão `open` (BER-72); alcançado → `done` (média só das notas, BER-42) ou `quiz`; primeiro não alcançado → `reading` com `end_page - currentPage`; os seguintes → `locked` com `end_page`.

**Tela (`app/book/[id].tsx`):** `Screen` sem scroll com `onBack`; `ScrollView` com `Cover` 100, título (`title`), autor, `Tag` de gênero e de páginas, `ProgressBar` da página atual; ação de estante (`Tirar da leitura` com `confirmDestructive`, ou `Voltar a ler`); capítulos em `ChapterRow` (done/quiz/open abrem o quiz; reading/locked desabilitados com o motivo); barra fixa "Registrar leitura" (`pathname: '/register-reading'`, `bookId`) quando em leitura; `PaywallSheet` no 402; erro de estante vira toast; carregando em `Skeleton`; erro em `EmptyState` com "Voltar". Rolar até o capítulo atual e header que colapsa ficam para a F7 (motion).

- Guardas: `app/book/[id].tsx` sai de `EXCECAO_COR`, `EXCECAO_FEEDBACK`, `EXCECAO_EMOJI`, `EXCECAO_TRAVESSAO`.

- [ ] Lógica: vermelho → verde → commit `feat(BER-77): estados de capítulo do detalhe do livro`
- [ ] Tela: teste de tela vermelho → verde → commit `feat(BER-77): detalhe do livro no sistema novo`

---

## Fora do escopo da F5

- Motion do Glyph (piscar, respirar, acenar), rolar até o capítulo atual e header que colapsa: F7.
- Apagar `QuizQuestionScreen`, `QuizMessageScreen`, `getScoreConfig` e demais legados sem uso: F9.
- Estante, Explorar, Você, planos, checkout, auth: F6.
