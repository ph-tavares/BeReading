# BeReading

App de leitura gamificada com IA. O aluno registra o que leu; ao completar um capítulo,
uma IA gera perguntas de **compreensão** e **reflexão** sobre o livro e avalia as
respostas com nota + feedback — no tom de companheiro de leitura, não de prova.

## Arquitetura

- **`mobile/`** — app **Expo / React Native** (expo-router, Zustand, NativeWind/Tailwind, `@supabase/supabase-js`).
- **`supabase/`** — backend **Supabase**: Edge Functions (Deno/TypeScript) + Postgres.
- ⚠️ O backend "vivo" é um **projeto Supabase na nuvem** — veja [Known issues](#️-known-issues--dívida-técnica).

## Rodar o app (mobile)

Pré-requisitos: Node ≥ 20, app **Expo Go** no celular (iOS/Android), celular na **mesma Wi-Fi** da máquina.

1. `cd mobile`
2. Crie `mobile/.env` (gitignored) apontando para o backend na nuvem:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key — Supabase Dashboard → Project Settings → API>
   ```
3. `npm install`
   *(o `mobile/.npmrc` já habilita `legacy-peer-deps`, necessário pelo conflito de peer dep React 19 × `lucide-react-native`).*
4. `npx expo start` → escaneie o QR com o **Expo Go**
   (iOS: abra a **Câmera** e aponte pro QR; Android: Expo Go → **Scan QR code**).
   Sem QR? No Expo Go → **Enter URL manually** → `exp://<ip-da-maquina>:8081`.

## Backend / Edge Functions (`supabase/functions`)

Funções: `generate-questions`, `evaluate-answer`, `register-reading-session`, `award-badges`, `retry-pending-quizzes`.

A IA do quiz é **configurável por secret** (sem mudar código):

| Secret | Valores |
|---|---|
| `AI_PROVIDER` | `openai` (default) ou `anthropic` |
| OpenAI | `AI_API_KEY`, `AI_MODEL` (default `gpt-4o-mini`) |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-haiku-4-5`) |

Setar secrets / deploy (CLI Supabase autenticada via `SUPABASE_ACCESS_TOKEN`):

```bash
supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=<sk-ant-...> --project-ref <ref>
supabase functions deploy generate-questions evaluate-answer --no-verify-jwt --project-ref <ref>
```

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
