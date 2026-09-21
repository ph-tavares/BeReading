# AGENTS.md — regras de trabalho no BeReading

Para quem vai **editar** este repositório: pessoa nova no time ou agente de IA
(Claude Code, Codex, Cursor — todos leem este arquivo). O `README.md` explica o
que o projeto é e como rodar; `docs/deploy.md` explica como as coisas vão ao ar.
**Este arquivo é sobre como não quebrar produção.**

> Verificado contra `main` @ `4f0f083` em 2026-09-15. Quando uma afirmação daqui deixar de
> valer, corrija-a no mesmo PR que a invalidou — um documento que mente é pior
> que documento nenhum. Este repositório já perdeu três meses por confiar num
> estado que não existia mais (BER-27).

---

## 1. O produto em 60 segundos

O aluno registra as páginas que leu. Ao cobrir um capítulo, uma IA gera 4
perguntas (compreensão + reflexão); o aluno responde em texto; outra IA dá nota
e feedback. Streaks e medalhas gamificam. Plano gratuito tem limite de IA;
`Premium` libera (BER-58/61, `PREMIUM_PLAN` em `_shared/plan-rules.ts`; cobrança
**simulada** — não há gateway real).

Produto é **B2C** desde 31/08/2026 (BER-52). O schema ainda carrega as tabelas
da fase escolar (`schools`, `classrooms`, `teachers`, `classroom_books`,
`classroom_teachers`) e o app tem o `ClassroomGateModal` — é esqueleto de fase 2
(BER-47), **não** é o produto atual. Não construa em cima disso sem decisão de
produto. O design spec escolar está arquivado em `docs/history/`.

Caminho do dado no loop principal:

```
app/register-reading.tsx (sheet)
  → edgeFunctions.registerReadingSession()        (JWT do usuário)
  → edge register-reading-session                 (service_role)
      grava reading_session, recalcula streak e student_books,
      detecta capítulo completo e dispara, via dispatchBackground():
        → generate-questions   (4 perguntas, cache por capítulo)
        → award-badges
  → capítulo fechado: app/chapter-complete.tsx (conquista; abre o quiz, ou
    convida ao Premium se a cota do mês acabou)
  → app faz polling de chapter_quiz_status até 'generated'
  → cada resposta → evaluate-answer → score + feedback
retry-pending-quizzes (pg_cron, horário) é a rede de segurança dos dois passos de IA.
```

---

## 2. Antes de abrir PR — rode os quatro checks

Os mesmos que o `ci.yml` roda. Rode **antes** de editar também, para conhecer o
baseline e não levar a culpa por vermelho alheio.

```bash
# mobile
cd mobile && npm ci
npx expo customize tsconfig.json   # gera .expo/types/router.d.ts (tipos das rotas)
npx tsc --noEmit
npx jest --ci

# backend (na raiz do repo)
cd supabase/functions
deno check register-reading-session/index.ts evaluate-answer/index.ts \
  award-badges/index.ts generate-questions/index.ts retry-pending-quizzes/index.ts \
  check-chapter-completion/index.ts delete-account/index.ts \
  lookup-book-by-isbn/index.ts get-entitlement/index.ts reading-list/index.ts \
  billing-mock/index.ts ingest-book/index.ts process-ingestion/index.ts \
  scan-page/index.ts \
  _shared/ingestion/supabase-store.ts
deno test --allow-net --allow-env
```

**Baseline medido em 2026-09-15 no `main` (`4f0f083`):** tudo verde —
`tsc` sem erros, `jest` 27 suítes / 207 testes, `deno check` limpo,
`deno test` 225 testes. Total 432. **Se algo estiver vermelho quando você
começar, esse vermelho não é seu — investigue antes de mexer.**

### Rotas tipadas: gere os tipos antes do `tsc` (BER-89)

`mobile/app.json` tem `experiments.typedRoutes: true`, mas o arquivo que dá
sentido a isso — `mobile/.expo/types/router.d.ts` — é **gerado e gitignored**
(`mobile/.gitignore:7`). Sem ele, o `tsc` cai num tipo permissivo e aceita
qualquer string de rota: medido em 2026-09-15, um `router.push('/rota-que-nao-existe')`
dava 0 erros sem o arquivo e `TS2345` com ele.

Desde a BER-89 o job `mobile` do `ci.yml` roda `npx expo customize tsconfig.json`
antes do type-check. O comando gera os tipos sem subir o Metro (o arquivo sai
idêntico ao do `npx expo start`) e não altera um `tsconfig.json` que já existe.
Uma rota inexistente agora reprova o PR.

Na prática:
- Rode o mesmo comando antes do `tsc` local. Um `router.d.ts` velho (de antes de
  alguém criar uma rota) dá `TS2345 ... is not assignable to ... RelativePathString`
  em rotas que existem — foi o que produziu os 6 erros medidos antes da BER-89.
- Não "conserte" esses erros com cast. Confirme primeiro se a rota existe em
  `mobile/app/`.

---

## 3. Invariantes — não quebre nenhum destes

1. **O dono da ação vem do JWT, nunca do corpo.** Função chamada pelo app usa
   `resolveUserId(authHeader, bodyUserId, getUser)` de `_shared/auth.ts`; o
   `user_id` do corpo só serve para detectar divergência e recusar com 403. Foi
   o IDOR do BER-30. Função interna (cron, chamada entre functions) usa
   `assertInternalCaller` / `isInternalCaller` com as chaves de `_shared/keys.ts`
   — **falham fechado** sem chave configurada. Mantenha assim. A secret key nova
   (`sb_secret_…`, BER-76) só vale no header `apikey`; a service_role legada (JWT)
   ainda vale no `Authorization` até as chaves legadas serem desativadas. Para uma
   function chamar outra, monte os headers com `internalCallHeaders` — nunca leia
   `SUPABASE_SERVICE_ROLE_KEY` direto.

2. **O cliente pode mentir; valide no servidor.** `streaks`, `student_badges` e
   `answers` são **somente leitura** pela RLS (BER-28) — quem escreve são as
   Edge Functions com `service_role`. `reading_sessions` entrou na mesma lista
   pela BER-87: com a policy `FOR ALL` antiga dava para gravar sessão sem passar
   pelo `register-reading-session`, e daí inflar XP e medalha (`pages_read`,
   BER-68) e destravar quiz de capítulo não lido (BER-48).
   `student_books` também é somente leitura
   para o cliente desde a BER-58: a migration `20260915120000_ber61_subscriptions.sql`
   removeu as policies de "comecei a ler", porque com elas o limite de livros do
   plano gratuito seria só visual (verificado em produção em 2026-09-15: só resta
   `student_books_read`, de SELECT). Começar e tirar livro da leitura passa pela
   Edge Function `reading-list`, que aplica a cota; todo avanço de página passa
   por `register-reading-session`. Se você adicionar estado de
   gamificação, ele nasce com essa mesma forma: escrita só no servidor.

3. **Trabalho em segundo plano usa `dispatchBackground()`** (`_shared/background.ts`),
   nunca `fetch(...).catch(() => {})` solto. Sem `EdgeRuntime.waitUntil` o worker
   morre antes de a chamada sair — foi exatamente isso que deixou o loop do quiz
   parado três meses (BER-27), com `attempts=0` como prova de que a função nunca
   rodou.

4. **Erro não se engole em silêncio.** Falha de geração/avaliação/medalha passa
   por `_shared/ops-alert.ts`. O que o BER-27 custou não foi o bug — foi ninguém
   ter ficado sabendo.

5. **A fonte da verdade do schema é `supabase/migrations/`,**
   a partir de `20260910210000_baseline_reconciled_from_live.sql` (BER-31).
   Mudança de schema = migration nova no repo. **Nunca aplique SQL direto em
   produção** — o deploy automático replica as migrations e sua alteração manual
   vira drift invisível. Os 5 arquivos em `docs/history/*.sql` são as migrations
   mortas da fase escolar: referência, jamais reexecução.

6. **Migration destrutiva precisa de reconhecimento explícito.** `DROP`,
   `TRUNCATE` ou `DELETE FROM` numa migration nova exige o comentário
   `-- allow-destructive: <motivo>`, senão o job `migration-safety` reprova o PR.
   O motivo existe: `deploy.yml` aplica migration em produção **sem revisão
   humana no meio**.

7. **Segredo e dado pessoal nunca entram no repositório — ele é PÚBLICO.**
   Verificado em 2026-09-15: `gh repo view --json isPrivate` → `false`. Isso
   vale para código, log, teste, fixture e print em PR. Dados da pesquisa com
   e-mails de participantes e transcrições de reunião ficam fora do git
   (`.gitignore` já bloqueia `docs/*.csv`, `*.txt`, `*.xlsx`). O credential do
   cron vive no Vault (BER-33/84), não em texto no `cron.job`.

8. **A cobrança é simulada — trate `Premium` como não confiável.** O
   `billing-mock` assina e cancela sem cobrar, gravando `provider='mock'` em
   `subscriptions`; enquanto ele estiver ligado, **qualquer usuário logado
   consegue virar Premium** (README §Planos; a compra real é a BER-79). Não
   construa nada que assuma que assinatura significa pagamento. O mock **só liga
   com o secret `BILLING_MODE=mock`** — sem o secret, ou com outro valor, a
   function recusa tudo (BER-85). Esse padrão *fail-closed* é a regra da casa
   para qualquer atalho de desenvolvimento: ausência de configuração nunca pode
   significar "modo permissivo ligado".

9. **Editar uma Edge Function não a coloca no ar — o merge em `main` coloca.**
   `deploy.yml` dispara depois que o CI fica verde no `main`. Não implante da
   sua máquina: a divergência de `entrypoint_path` entre as functions é o
   registro histórico de quando isso era feito à mão (ver o cabeçalho do
   `deploy.yml`).

---

## 4. Convenções

- **Idioma:** código, comentários, commits e PRs em **PT-BR**. Identificadores
  em EN/PT misto — siga o que já existe no arquivo em vez de padronizar.
- **Comentário explica o *porquê*, com evidência.** O padrão da casa é citar a
  issue (`BER-XX`) e o que se mediu. Veja `_shared/auth.ts` ou
  `20260911150954_ber28_lock_down_gamification_writes.sql`. Imite isso.
- **Teste exercita a fonte, não uma cópia.** Foi o BER-35/65: arquivos de teste
  redefiniam a lógica localmente, então mudar o código real não quebrava teste
  nenhum — `calculateNewStreak` tinha 4 testes verdes e sequer existia no
  handler. Importe sempre do módulo real, e use os apoios que já existem:
  `_shared/test-support/fakeSupabase.ts` e `mockAI.ts`.
- **Lógica pura sai da rota.** No backend o padrão é: `index.ts` exporta
  `handler(req)` (IO, auth, Supabase, IA) e a regra de negócio mora em módulo
  irmão com nome de domínio — `prompt.ts`, `submission.ts`, `claim.ts`,
  `reading.ts`, `filter.ts`. O `handler.test.ts` faz `await import('./index.ts')`
  e exercita o `handler` de verdade contra o `fakeSupabase`. No app, a regra sai
  da tela para `src/utils/`, ou, nas telas do redesign (BER-77), para o
  `logic.ts` da feature em `src/features/<tela>/`, com XP e nível em `src/game/`.
  É o que torna esses testes possíveis.
- **Branch:** `tipo/ber-XX-descricao` (`feat`, `fix`, `docs`, `chore`, `refactor`,
  `test`, `ci`). Trunk-based em `main`, PR pequeno.
- **PR:** preencha `.github/pull_request_template.md` — resumo, issue do Linear,
  riscos e rollback, como testar, checklist. `CODEOWNERS` pede revisão ao time
  automaticamente.
- **Backlog:** Linear, projeto *Auditoria Técnica — Jul/2026*
  (https://linear.app/tpgn/project/auditoria-tecnica-jul2026-f978e6046217).

---

## 5. Onde as coisas ficam

| Preciso de… | Vá para |
|---|---|
| O que construir, para quem, e o que **não** construir | `docs/product.md` |
| Rodar o app, stack, secrets de IA | `README.md` |
| Implantar, secrets do Actions, backup/restauração, troubleshooting | `docs/deploy.md` |
| Build e distribuição do app | `docs/mobile-build.md` |
| Rodar a ingestão na sua máquina, com IA pelo Claude Code | `docs/ingestao-local.md` |
| Testar o assistente de leitura na sua máquina (foto da página) | `docs/assistente-local.md` |
| Por que um documento antigo não vale mais | `docs/history/README.md` |
| Boas práticas de Postgres/RLS | `.agents/skills/supabase-postgres-best-practices/` |
| Runbook do cron lendo o Vault | `supabase/runbooks/ber-33-cron-vault.sql` |
| Schema real | `supabase/migrations/20260910210000_baseline_reconciled_from_live.sql` |

**Backend vivo:** projeto Supabase `asfdkzejtuqcgqdcsnac` (o `.mcp.json` já
aponta o MCP). É produção, com dados de pessoas reais. Trate leitura como
padrão e escrita como exceção que precisa de motivo.
