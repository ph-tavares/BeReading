# BeReading

App de leitura gamificada com IA. O aluno registra o que leu; ao completar um capítulo,
uma IA gera perguntas de **compreensão** e **reflexão** sobre o livro e avalia as
respostas com nota + feedback — no tom de companheiro de leitura, não de prova.

Contexto de produto — posicionamento, público, o que está fora de escopo e por quê:
[`docs/product.md`](docs/product.md). Regras para quem edita o repositório (pessoa ou
agente de IA): [`AGENTS.md`](AGENTS.md).

## Arquitetura

- **`mobile/`** — app **Expo / React Native** (expo-router, Zustand, Reanimated, `StyleSheet` com os tokens de `src/theme`, `@supabase/supabase-js`).
- **`supabase/`** — backend **Supabase**: Edge Functions (Deno/TypeScript) + Postgres.
- ⚠️ O backend "vivo" é um **projeto Supabase na nuvem** — veja [Known issues](#️-known-issues--dívida-técnica).

## Rodar o app (mobile)

Pré-requisitos: Node ≥ 20, app **Expo Go** no celular (iOS/Android), celular na **mesma Wi-Fi** da máquina.

1. `cd mobile`
2. Crie `mobile/.env` (gitignored) apontando para o backend na nuvem:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key, sb_publishable_… — Supabase Dashboard → Project Settings → API Keys>
   ```
3. `npm install`
   *(o `mobile/.npmrc` já habilita `legacy-peer-deps`, necessário pelo conflito de peer dep React 19 × `lucide-react-native`).*
4. `npx expo start` → escaneie o QR com o **Expo Go**
   (iOS: abra a **Câmera** e aponte pro QR; Android: Expo Go → **Scan QR code**).
   Sem QR? No Expo Go → **Enter URL manually** → `exp://<ip-da-maquina>:8081`.

## Backend / Edge Functions (`supabase/functions`)

Funções: `generate-questions`, `evaluate-answer`, `register-reading-session`, `award-badges`,
`retry-pending-quizzes`, `delete-account`, `lookup-book-by-isbn`, `check-chapter-completion` (stub),
`get-entitlement`, `reading-list`, `billing-mock`, `ingest-book`, `process-ingestion`,
`scan-page` (BER-100 — a foto da página do assistente de leitura).

A IA do quiz é **configurável por secret** (sem mudar código):

| Secret | Valores |
|---|---|
| `AI_PROVIDER` | `openai` (default) ou `anthropic` |
| OpenAI | `AI_API_KEY`, `AI_MODEL` (default `gpt-4o-mini`) |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-4-5`) |

Os secrets das functions continuam sendo definidos à mão (o deploy automático não mexe neles):

```bash
supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=<sk-ant-...> --project-ref <ref>
```

## Planos e assinatura (BER-58 / BER-61)

- **Gratuito:** os limites são secrets das Edge Functions. Dá para mudar sem migration e sem deploy de código:

  | Secret | Default | O que limita |
  |---|---|---|
  | `FREE_MAX_ACTIVE_BOOKS` | `2` | Livros em leitura ao mesmo tempo. Tirar um livro da leitura libera a vaga, e a página em que parou fica salva. |
  | `FREE_MONTHLY_QUIZ_CHAPTERS` | `4` | Capítulos com quiz iniciados no mês. Um capítulo já começado nunca trava no meio. Zera à meia-noite do dia 1, no horário de São Paulo. |

  Aceitam um inteiro ≥ 0 ou `unlimited`. Um valor inválido cai no default.

  ```bash
  supabase secrets set FREE_MONTHLY_QUIZ_CHAPTERS=6 --project-ref <ref>
  ```

- **Premium:** R$ 24,90/mês, sem limites. Quem aplica os limites é o servidor (`evaluate-answer`, `reading-list` e `register-reading-session`). O app só mostra o que `get-entitlement` devolve.
- ⚠️ **A cobrança é simulada.** O `billing-mock` assina, cancela e retoma sem cobrar nada, e grava `provider = 'mock'` em `subscriptions`. Enquanto isso valer, **qualquer usuário logado consegue virar Premium**. O mock **só liga com o secret `BILLING_MODE=mock`**; sem o secret, ou com outro valor, a function recusa tudo (BER-85). A troca pela compra in-app real está na **BER-79**.

## Deploy

Migrations e Edge Functions vão para produção **automaticamente** depois que o CI passa no
`main` (`.github/workflows/deploy.yml`, BER-50). Não implante da sua máquina e não aplique
SQL de schema direto em produção — isso dessincroniza o histórico de migrations e trava o
próximo deploy. Runbook completo (secrets, deploy manual, rotação de token, troubleshooting):
[`docs/deploy.md`](docs/deploy.md).

## Distribuição do app (BER-51)

O app só roda via Expo Go hoje — sem instalável para dar na mão de um leitor de
verdade. `mobile/eas.json` e o workflow `.github/workflows/mobile-build.yml` deixam o
build via EAS pronto para configurar (conta EAS, contas de desenvolvedor Apple/Google e
o `bundleIdentifier` definitivo ainda faltam — nada disso foi criado). Runbook completo:
[`docs/mobile-build.md`](docs/mobile-build.md).

## ⚠️ Known issues / dívida técnica

- ~~`supabase/migrations/` dessincronizado da nuvem~~ — **resolvido (BER-31).** O schema foi
  reconciliado a partir do banco vivo em `20260910210000_baseline_reconciled_from_live.sql`,
  que é a fonte única da verdade desde 10/09/2026. `supabase start` / `supabase db reset`
  agora aplicam do zero com paridade real — as 5 migrations antigas (`students`/`student_id`,
  com o erro de sintaxe em `005_book_contents_pilot.sql`) foram movidas para
  `docs/history/` como referência histórica, não para reexecução.
- ~~Edge Functions com `verify_jwt=false` aceitando `user_id` sem validar contra o JWT (IDOR)~~
  — **resolvido no código (BER-30).** As funções de ação do usuário derivam o dono da ação do
  JWT (`resolveUserId`, em `_shared/auth.ts`); `user_id` no corpo só serve para detectar
  divergência. Não verificamos aqui se a flag `verify_jwt` de cada function no projeto de
  produção também foi atualizada — isso é configuração de deploy, fora do repositório.
