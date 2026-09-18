# Deploy — runbook

Produção é o projeto Supabase `asfdkzejtuqcgqdcsnac`. Tudo que chega nele (migrations e
Edge Functions) passa pelo workflow `.github/workflows/deploy.yml`, criado na BER-50.

## Como funciona

| Quando | O que acontece |
|---|---|
| PR aberto | `ci.yml` roda type-check e testes (mobile e functions) e o check `migration-safety` |
| Merge no `main` | `ci.yml` roda de novo; se passar, dispara `deploy.yml` |
| Manual | Actions → **Deploy** → **Run workflow** (ou `gh workflow run deploy.yml`) |

Passos do `deploy.yml`, em ordem. Se um falhar, os seguintes não rodam:

1. **Dry run das migrations:** `supabase start` + `supabase db reset` aplicam todas as
   migrations do zero num Postgres local do runner. Erro aqui não chega em produção.
2. **Migrations em produção:** `supabase db push --db-url "$SUPABASE_DB_URL"`. Aplica só os
   arquivos de `supabase/migrations/` que ainda não constam no histórico do banco.
3. **Edge Functions:** `supabase functions deploy` de cada pasta em `supabase/functions/`
   (exceto `_shared`), com `--no-verify-jwt`. A autenticação é feita no código
   (`_shared/auth.ts`), não no gateway.
4. **Smoke test:** chama cada function sem credencial. `500` ou timeout falham o job.

O deploy **não faz rollback**. Se o smoke test falhar, a versão nova já está no ar e a
correção é um novo PR (ou reimplantar a versão anterior manualmente).

## Regras

- **Schema só muda por migration mergeada.** Não aplique SQL de schema pelo SQL Editor, pelo
  MCP ou pela CLI local em produção. Uma migration aplicada fora do pipeline entra no histórico
  com outro número e o próximo `db push` para com
  `Remote migration versions not found in local migrations directory`.
- **Migration destrutiva exige reconhecimento.** Arquivo novo com `DROP TABLE`, `DROP COLUMN`,
  `TRUNCATE` ou `DELETE FROM` falha o check `migration-safety` no PR, a menos que contenha um
  comentário `-- allow-destructive: <motivo>`. Como o deploy é automático, ninguém revisa o SQL
  entre o merge e a produção.
- **Migrations precisam rodar do zero.** O dry run aplica tudo num banco vazio; uma migration
  que depende de estado que só existe em produção quebra o deploy no passo 1.
- **Secrets das functions** (`AI_PROVIDER`, `AI_API_KEY`, `ANTHROPIC_API_KEY` etc.) não são
  gerenciados pelo pipeline; continuam sendo definidos com `supabase secrets set`.
- **A versão do Supabase CLI é fixa** (`version:` do `supabase/setup-cli` no `deploy.yml` e no
  `backup.yml`, BER-90). Com `latest`, a action pergunta a versão à API do GitHub sem
  autenticação e pode falhar por rate limit (ver [Troubleshooting](#failed-to-resolve-latest-supabase-cli-release-rate-limit-exceeded)).
  Para atualizar:
  1. Escolha uma versão estável em <https://github.com/supabase/cli/releases>, sem `-beta`.
  2. Troque a versão **nos dois arquivos no mesmo PR**.
  3. Depois do merge, confira o deploy. Rode também o **Backup** manualmente (Actions → Backup →
     Run workflow): a restauração verificada é o que prova que a versão nova ainda restaura o
     banco.

## Secrets do GitHub Actions

Settings → Secrets and variables → Actions:

| Secret | Usado em | Como obter |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | deploy das Edge Functions | Dashboard → avatar → Access Tokens. Escopo: projeto BeReading, Full access |
| `SUPABASE_DB_URL` | `db push` | Projeto → **Connect** → **Direct** → **Session pooler** (porta 5432), com a senha do banco |
| `SUPABASE_ANON_KEY` | smoke test do deploy; versão do Auth na verificação do backup | Project Settings → API Keys → a **publishable key** (`sb_publishable_…`). Não use a `anon` legada, que será desativada (BER-76) |
| `BACKUP_ENCRYPTION_KEY` | `backup.yml` (criptografia do backup) | Gerada pelo time; cópia obrigatória no gerenciador de senhas. Ver [Backup e restauração](#backup-e-restauração) |

Ao gravar, evite espaço ou quebra de linha no final do valor. No PowerShell:

```powershell
$v = Read-Host "Valor" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($v)).Trim()
gh secret set NOME_DO_SECRET --body $plain
```

### `SUPABASE_DB_URL`

- Use o **Session pooler**. A conexão direta (`db.<ref>.supabase.co`) só responde por IPv6, e
  os runners do GitHub não têm IPv6. O Transaction pooler (porta 6543) não funciona bem com
  `db push`.
- Troque `[YOUR-PASSWORD]` inteiro, colchetes inclusive.
- Caracteres especiais da senha precisam ir codificados na URL (`@` → `%40`, `#` → `%23`,
  `/` → `%2F`, `:` → `%3A`).
- Se a senha do banco for resetada, este secret precisa ser atualizado.

### Rotação do `SUPABASE_ACCESS_TOKEN`

Tokens do Supabase expiram (o atual foi criado com validade de 1 mês). Para rotacionar:

1. Gere um token novo com o mesmo escopo.
2. Atualize o secret no GitHub.
3. Dispare o deploy manualmente e confirme que passou.
4. Só então revogue o token antigo.

Use tokens diferentes para o GitHub Actions e para ferramentas locais (MCP, CLI), para que
revogar um não derrube o outro.

## Backup e restauração

O projeto está no **plano gratuito do Supabase, que não faz backup**. Até migrar para o Pro
(gatilho e passos na BER-83), o backup é feito pelo workflow `.github/workflows/backup.yml`.

### Como funciona

- **Quando:** todo dia às 06:00 UTC (03:00 em São Paulo), ou manualmente em Actions →
  **Backup** → **Run workflow**.
- **O que exporta:** três arquivos via `supabase db dump`:
  - `roles.sql`: papéis do banco;
  - `schema.sql`: estrutura;
  - `data.sql`: dados, **incluindo as contas (`auth.users`)**. Ficam de fora o `vault`, o
    agendamento e o histórico do cron e duas tabelas internas vazias do Storage (lista em
    [Limites](#limites)).
- **Criptografia:** os três arquivos viram um `.tar.gz`, criptografado com GPG (AES-256) usando o
  secret `BACKUP_ENCRYPTION_KEY`. Só o arquivo `.gpg` sai do runner.
- **Verificação:** o próprio job descriptografa a cópia, restaura num Supabase local vazio, com
  Auth e Storage nas mesmas versões de produção, e compara a contagem de `auth.users`, `profiles`, `reading_sessions`, `answers`,
  `student_books` e `subscriptions` com a de produção. O log mostra só "confere" ou "diverge".
- **Onde fica:** artefato `bereading-db-AAAAMMDD-HHMM` da execução, **por 14 dias**.

**O repositório é público.** Artefatos e logs das execuções podem ser vistos por qualquer
pessoa logada no GitHub. Por isso a cópia só existe criptografada e o log nunca mostra dados.
Não altere o workflow para imprimir conteúdo, contagens ou subir arquivos em claro.

### A chave

- **Quem guarda:** o Nikolas, com cópia obrigatória no gerenciador de senhas do time.
- **Por que a cópia é obrigatória:** o secret do GitHub não pode ser lido de volta. Sem a
  cópia fora do GitHub, os backups não abrem.
- **Trocar a chave:** gere uma nova, atualize o secret e o gerenciador. **Guarde a antiga
  por 14 dias**: os backups anteriores à troca continuam criptografados com ela.

Para gerar uma chave (PowerShell):

```powershell
$bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
Set-Clipboard $key   # cole no gerenciador de senhas e no secret; não salve em arquivo
gh secret set BACKUP_ENCRYPTION_KEY --body $key
```

### Restaurar

Restaurar **sobrescreve produção**. Faça só com o time avisado, de preferência depois de
testar a mesma cópia num Supabase local (passos 1 a 4 abaixo, trocando o destino).

1. Baixe o artefato em Actions → **Backup** → execução do dia → **Artifacts** (ou
   `gh run download <id> -n bereading-db-AAAAMMDD-HHMM`).
2. Descriptografe (pede a chave do gerenciador de senhas):
   ```bash
   gpg --decrypt --output bereading-db.tar.gz bereading-db-AAAAMMDD-HHMM.tar.gz.gpg
   tar -xzf bereading-db.tar.gz   # gera roles.sql, schema.sql e data.sql
   ```
   **No Windows**, o `gpg` vem com o Git for Windows e só está no caminho do **Git Bash**. No
   PowerShell, use o caminho completo:
   `& "C:\Program Files\Git\usr\bin\gpg.exe" --decrypt --output ...`. O `tar` já vem com o Windows.
3. Aponte para o banco de destino. Para testar localmente, use o banco de um `supabase start`
   num projeto **vazio** (sem migrations): `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
   Antes do `supabase start`, grave as versões de produção em `supabase/.temp/gotrue-version`
   (campo `version` de `/auth/v1/health`, com o header `apikey`) e `supabase/.temp/storage-version`
   (`v` + a resposta de `/storage/v1/version`). Sem isso, a restauração pode falhar como em
   [`relation "auth.…" does not exist`](#relation-auth-does-not-exist-na-verificação-do-backup).
   Para produção, a URI do Session pooler.
4. Restaure na ordem roles → schema → dados, numa transação só:
   ```bash
   psql "$DESTINO" --single-transaction -v ON_ERROR_STOP=1 \
     -f roles.sql -f schema.sql \
     -c 'SET session_replication_role = replica' \
     -f data.sql
   ```
   **Sem `psql` instalado (teste local):** rode o `psql` de dentro do container do banco. O nome é
   `supabase_db_<project_id do config.toml>`:
   ```bash
   docker exec supabase_db_<project_id> mkdir -p /tmp/restore
   docker cp roles.sql supabase_db_<project_id>:/tmp/restore/   # idem schema.sql e data.sql
   docker exec supabase_db_<project_id> psql -U postgres -d postgres --single-transaction \
     -v ON_ERROR_STOP=1 -f /tmp/restore/roles.sql -f /tmp/restore/schema.sql \
     -c 'SET session_replication_role = replica' -f /tmp/restore/data.sql
   ```
   **No Git Bash**, o `docker exec`/`docker cp` com caminhos `/tmp/...` precisa de
   `MSYS_NO_PATHCONV=1`, e aí o caminho do arquivo no Windows tem que ir como `C:/Users/...`, não
   `/c/Users/...`.
5. **Recrie o trigger de cadastro.** O `schema.sql` exclui o schema `auth` inteiro, e com ele o
   trigger `on_auth_user_created` em `auth.users`, o **único objeto do time** nos schemas `auth` e
   `storage` (verificado em 15/09/2026). A função `public.handle_new_user` vem na cópia; o trigger
   não. Sem ele, os dados restauram certos, mas **todo cadastro novo fica sem perfil** e o app quebra
   para quem entrar depois da restauração.
   ```sql
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute function public.handle_new_user();
   ```
   Confira que funciona, sem deixar resto (a transação é desfeita no fim):
   ```sql
   begin;
   insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                           email_confirmed_at, raw_user_meta_data, created_at, updated_at)
   values ('00000000-0000-4000-8000-00000000beef', '00000000-0000-0000-0000-000000000000',
           'authenticated', 'authenticated', 'teste-restauracao@example.invalid', '', now(),
           '{"display_name":"Teste Restauracao"}', now(), now());
   select count(*) from public.profiles
    where user_id = '00000000-0000-4000-8000-00000000beef';   -- esperado: 1
   rollback;
   ```
6. **Recrie os segredos do Vault e o agendamento do cron.** Nenhum dos dois está na cópia: o
   `vault` fica de fora de propósito, e `cron.job` pertence a um papel de sistema que o `postgres`
   não pode escrever. No SQL Editor do projeto restaurado:
   ```sql
   -- valores: URL do projeto (https://<ref>.supabase.co) e o CRON_SECRET das Edge Functions
   select vault.create_secret('<url-do-projeto>', 'project_url');
   select vault.create_secret('<valor-do-CRON_SECRET>', 'cron_secret');

   select cron.schedule(
     'retry-pending-quizzes',
     '0 * * * *',
     $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
              || '/functions/v1/retry-pending-quizzes',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'cron_secret'),
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
     $$
   );
   ```
   A fonte do comando do cron é a migration `20260915130000_ber84_cron_retry_reads_vault.sql`
   (BER-84); o SQL acima é o mesmo. Ele precisa ser rodado à mão aqui porque migrations não rodam
   numa restauração de backup. **Não use o bloco de cron da migration baseline**
   (`20260910210000_...`): ele é anterior à BER-33 e lê o segredo antigo `cron_service_role_key`.
   Os valores dos segredos (URL e `CRON_SECRET`) nunca ficam em arquivo; ver também
   `supabase/runbooks/ber-33-cron-vault.sql` para criação e rotação.
7. Confira:
   - contagens principais (`auth.users`, `profiles`, `reading_sessions`, `answers`, `subscriptions`)
     iguais às de produção no horário da cópia;
   - nenhuma conta sem identidade (`auth.identities`) ou sem perfil (`public.profiles`);
   - login de uma conta de teste;
   - na hora cheia seguinte, uma execução com sucesso do `retry-pending-quizzes` em
     `cron.job_run_details`.
8. **Apague os arquivos descriptografados** (`.sql` e `.tar.gz`) da máquina. Eles têm dados
   pessoais em claro. No teste local, pare o banco com `supabase stop --no-backup` para não deixar
   os dados num volume do Docker.

Último restore manual: **15/09/2026**, cópia `bereading-db-20260915-1120`, num Supabase local
vazio. Todas as contagens bateram com produção; o trigger de cadastro precisou ser recriado (passo 5).

### Limites

- **Perda máxima de até 24h**, o intervalo entre backups.
- **Restauração manual**, com o app fora do ar enquanto roda.
- **Não inclui os arquivos do Storage**, só os metadados. Em 15/09/2026 o Storage tem um bucket
  público, `public-assets`, com 6 arquivos estáticos do app (~9,8 MB, de 30/03/2026), nenhum
  enviado por leitores. Se o app passar a guardar arquivo de usuário, este backup não cobre.
- **Fora da cópia, de propósito:** segredos do `vault`, o agendamento `cron.job`, o histórico
  `cron.job_run_details` e as tabelas vazias `storage.buckets_vectors` e `storage.vector_indexes`.
- **Fora da cópia, por limitação do `db dump`:** o trigger `on_auth_user_created` em `auth.users`,
  porque a exportação de estrutura exclui o schema `auth`. O passo 5 de "Restaurar" o recria, e o
  workflow testa esse passo a cada execução. Se o time criar outro trigger, função ou policy nos
  schemas `auth` ou `storage`, ele também fica de fora e precisa entrar no runbook e no workflow.
- **Workflows agendados em repositório público são desligados pelo GitHub após 60 dias sem
  atividade no repositório.** Se o projeto ficar parado, confira se o Backup continua ativo
  em Actions.
- **Falha avisa por email** quem fez a última alteração no agendamento do workflow (notificação
  padrão do GitHub para execuções agendadas).

## Ingestão de conteúdo (BER-59)

Monta, a partir de um ISBN, a base de conhecimento verificado de cada capítulo, com fontes legais
da internet. Design: `docs/superpowers/specs/2026-09-16-ber-59-ingestao-conteudo-capitulo-design.md`.

**Neste ciclo o app não lê nada disto.** As tabelas da ingestão têm RLS sem policy: fato de
capítulo é spoiler, e só as functions com chave de servidor acessam.

### Como funciona

- `ingest-book` (interna) recebe `{ "isbn": "...", "book_id": "<uuid, opcional>" }`, cria o run e
  enfileira o primeiro passo. Devolve `202` com `run_id`.
- O `pg_cron` confere a cada 20 s se há trabalho (passo pronto, trava velha ou run aberto) e só
  então chama `process-ingestion` (job `process-ingestion`, migration `20260918150000`). Com a
  fila vazia, chama uma vez a cada 10 min, para limpar texto vencido e agendar rebuscas.
- Cada chamada reivindica um passo por vez e para de reivindicar outro depois de 70 s de relógio
  **ou 1 s de CPU**: a Edge Function morre com `CPU Time exceeded` aos 2 s. A resposta da chamada
  traz `cpuMs` quando o runtime expõe o gasto (veja em `net._http_response`).
- PDF é lido em lotes de 50 páginas, um passo `fetch` por lote (assunto `…#bereading-pagina-N`);
  a extração só começa depois do último lote.
- Como o `pg_cron` dispara sem esperar a chamada anterior terminar, invocações do
  worker podem se sobrepor. Isso é aceito: `claim_ingestion_steps` reivindica cada passo com
  trava exclusiva (`for update skip locked`), então duas invocações nunca executam o mesmo passo;
  o limite por domínio (`fetchPage`/`fetchRobots`), porém, é por invocação, não global.
- Um livro leva alguns minutos, conforme o número de fontes e de blocos de texto.
- `ingestion_claims.chunk_index` identifica o bloco de texto que gerou cada afirmação, para a
  extração ser idempotente numa retentativa (migration `20260918120000`).

A segunda migration do BER-59 (`20260918120000_ber59_claims_chunk_index.sql`) precisa aplicar
antes da migration do cron (`20260918130000_ber59_cron_process_ingestion.sql`). A ordem é
automática pelo nome do arquivo (timestamp).

### Secrets das functions

Definidos com `supabase secrets set` (não são secrets do GitHub):

| Secret | Para quê |
|---|---|
| `TAVILY_API_KEY` | Busca de fontes. Conta em tavily.com; o plano gratuito dá 1.000 créditos por mês |
| `INGESTION_ENABLED` | `false`/`0`/`off`/`no` (sem diferenciar caixa, com ou sem espaço em volta) desligam tudo sem deploy: `ingest-book` devolve 503 e o worker não executa |
| `INGESTION_ALLOW_NO_DNS` | Desligado por padrão (não definir). Se o runtime não expuser DNS, o download recusa todo host em vez de pular a checagem de IP interno (SSRF); `true` libera sem essa checagem, só com o risco aceito |
| `ANTHROPIC_API_KEY` / `AI_PROVIDER` | Já existem (quiz). A ingestão usa o mesmo provedor |
| `ANTHROPIC_FALLBACK_API_KEY` | Opcional. Credencial de reserva, usada só quando a principal acusa saldo esgotado (spec §11, item 42). `ANTHROPIC_FALLBACK_BASE_URL` e `ANTHROPIC_FALLBACK_MODEL` acompanham quando a reserva fica em outra conta, gateway ou nuvem; para OpenAI, os equivalentes `AI_FALLBACK_*` |
| `CRON_SECRET` | Já existe (BER-33). O cron da ingestão usa o mesmo |
| `OPS_ALERT_WEBHOOK_URL` | Já existe (BER-39, `_shared/ops-alert.ts`). Opcional: sem ela, os avisos do worker (`ctx.notify`) só vão para os logs da function; com ela, também vão para o webhook (Slack/Discord/ntfy — qualquer um que aceite `POST { text }`) |

### Disparar um livro

```bash
curl -X POST "https://asfdkzejtuqcgqdcsnac.supabase.co/functions/v1/ingest-book" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Content-Type: application/json" \
  -d '{"isbn": "9788535914849"}'
```

`$SUPABASE_SECRET_KEY` é a secret key (`sb_secret_…`, Project Settings → API Keys). Não use a
publishable. Tetos: 10 runs novos por dia, 30 buscas, 60 fontes e US$ 3,00 por run, e 120 créditos
Tavily por dia (um livro usa até 30). O limite do plano gratuito do Tavily é 1.000 créditos por
mês, ou seja ~33 livros: acompanhe em tavily.com antes de disparar muitos livros seguidos.

### Acompanhar

```sql
-- Situação e custo do run
select status, status_reason, stats, structure_divergence, started_at, finished_at
from public.ingestion_runs where id = '<run_id>';

-- Passos parados ou com erro
select kind, subject, status, attempts, next_attempt_at, error
from public.ingestion_steps where run_id = '<run_id>' and status <> 'done'
order by created_at;

-- Fontes rejeitadas por motivo
select rejection_reason, is_book_file, count(*)
from public.ingestion_sources where run_id = '<run_id>' and decision = 'rejected'
group by 1, 2 order by 3 desc;

-- Resultado por capítulo
select ec.number, ec.title, ck.status, ck.confidence, count(cf.id) as fatos
from public.edition_chapters ec
join public.ingestion_runs r on r.edition_id = ec.edition_id and r.id = '<run_id>'
left join public.chapter_knowledge ck on ck.edition_chapter_id = ec.id
left join public.chapter_facts cf on cf.chapter_knowledge_id = ck.id
group by 1, 2, 3, 4 order by 1;

-- Runs "queued"/"running" sem passo pendente/rodando: o worker já devia ter avançado sozinho
-- (recoverStalledRuns cuida disso a cada ciclo, 5 min depois de o run começar; se aparecer algo
-- aqui com mais de alguns minutos, o worker não está rodando ou está caindo antes desse passo).
select r.id, r.edition_id, r.status, r.status_reason, r.started_at
from public.ingestion_runs r
where r.status in ('queued', 'running')
  and not exists (
    select 1 from public.ingestion_steps s
    where s.run_id = r.id and s.status in ('pending', 'running')
  )
order by r.started_at;
```

### Pausar, desligar ou acompanhar o cron

```sql
-- Últimas execuções do job (sucesso/erro, duração; pg_net é assíncrono, então "sucesso" aqui só
-- quer dizer que o POST foi disparado, não que o worker terminou sem erro — ver "Acompanhar" acima)
select start_time, end_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'process-ingestion')
order by start_time desc limit 20;
```

- **Pausar sem tirar do ar:** secret `INGESTION_ENABLED=false` (ou `0`/`off`/`no`) nas functions.
  O `pg_cron` continua chamando `process-ingestion` a cada minuto, mas a chamada devolve
  `200 { skipped: ... }` sem tocar a fila nem o worker. Reversível na hora, sem deploy — é o jeito
  certo para incidente.
- **Desligar o agendamento de vez:** `select cron.unschedule('process-ingestion');` no SQL Editor.
  Isso só some enquanto ninguém rodar as migrations nesse projeto: o próximo `db push` reaplica
  `20260918130000_ber59_cron_process_ingestion.sql` (`cron.schedule`/`cron.alter_job` no `do $do$`)
  e o job volta. Para desligar de vez **precisa** de uma migration nova que rode
  `cron.unschedule`, senão o repositório e o banco divergem silenciosamente.

### Lista de domínios

`public.source_domain_policies` decide peso e bloqueio por domínio. Domínio fora da lista entra com
peso D. Para bloquear um site cujos termos proíbem acesso automatizado:

```sql
insert into public.source_domain_policies (domain, policy, reason)
values ('exemplo.com', 'blocked', 'Termos proíbem acesso automatizado');
```

Mudança de lista vai por migration quando for permanente, para não divergir do repositório.

### Regras que não mudam sem decisão do time

- Texto integral sem sinal de autorização: decisão de 17/09/2026 de aceitar como `PDF_content`,
  peso B (spec §11, item 23). Até então era rejeitado com `texto_integral_sem_autorizacao`. Para
  listar esses textos: `source_type = 'PDF_content'`.
- Texto bruto de fonte só existe em `ingestion_source_texts`, apagado ao fim da extração e fora do
  backup (`-x public.ingestion_source_texts` no `backup.yml`).

## Troubleshooting

### `Authorization failed for the access token and project ref pair`

Aparece no `supabase link`, que o pipeline **não usa de propósito**: o link lê
`GET /v1/projects/{ref}/api-keys`, e esse endpoint devolve 403 para membros com papel
Administrator na organização, mesmo com token Full access. Se alguém reintroduzir o
`supabase link` no workflow, o erro volta. Os passos atuais não dependem dele.

Para testar um token fora do pipeline:

```powershell
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/asfdkzejtuqcgqdcsnac" -Headers @{ Authorization = "Bearer $plain" }
```

### `Failed to resolve latest Supabase CLI release: rate limit exceeded`

O passo `supabase/setup-cli` foi configurado com `version: latest`. Nesse modo, a action consulta
`api.github.com` sem autenticação, e o limite é por IP, compartilhado entre os runners do GitHub.
Aconteceu no deploy do #39 (15/09/2026), antes de qualquer passo em produção. A correção
permanente é manter a versão fixa (ver [Regras](#regras)). Se reaparecer num workflow que ainda
use `latest`, basta rodar o job de novo.

### `relation "auth.…" does not exist` na verificação do backup

O Supabase atualizou o Auth ou o Storage de produção para uma versão com tabela nova, e o
Supabase local da verificação subiu com a versão embutida no CLI, mais velha. Aconteceu em
16/09/2026 com `auth.mfa_recovery_code_sets` (gotrue v2.197.0 em produção, v2.196.0 no CLI
2.117.0) e nenhum backup foi salvo, porque o upload só roda depois da verificação (BER-92).
Desde então o `backup.yml` consulta as versões de produção antes do `supabase start`. Se voltar a
acontecer, veja no log se apareceu o aviso `não foi possível ler a versão de …`: a consulta falhou
(confira o secret `SUPABASE_ANON_KEY`) e a verificação usou as versões do CLI.

### `password authentication failed for user "postgres"`

Senha errada no `SUPABASE_DB_URL`: colchetes do placeholder, caractere especial sem
codificação ou senha resetada. Ver [`SUPABASE_DB_URL`](#supabase_db_url).

### `Remote migration versions not found in local migrations directory`

O histórico do banco tem versões sem arquivo correspondente no repo, quase sempre porque algo
foi aplicado fora do pipeline. **Não rode o `supabase migration repair` sugerido às cegas.**

1. Liste o histórico no SQL Editor:
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```
2. Compare com `supabase/migrations/`. Para cada versão remota sem arquivo, descubra se o
   conteúdo já está coberto por algum arquivo do repo (mesma migration com outro número, ou
   incluída na baseline).
3. Para cada arquivo do repo **sem** versão remota, confira no banco se a mudança já existe.
   Se já existe, o `db push` vai tentar executar de novo e pode falhar ou duplicar efeito.
4. Ajuste só a tabela de histórico (remover versões órfãs, registrar as já aplicadas) e rode
   o deploy.

Foi o que aconteceu no primeiro deploy (14/09/2026): cinco versões remotas estavam cobertas
pela baseline da BER-31, e a BER-72 tinha sido aplicada à mão com outro número. Detalhes na
BER-50.

### Smoke test falhou

O job lista o status de cada function. `500` indica erro de runtime logo na entrada; veja os
logs da function no Dashboard (Edge Functions → nome → Logs). `401`/`400` sem credencial é o
esperado.
