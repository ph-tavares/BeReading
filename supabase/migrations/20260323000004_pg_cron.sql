-- pg_cron: retry AI question generation for failed chapters
-- Runs every hour. Requires pg_cron and pg_net extensions (enabled by default on Supabase Cloud).
-- On Supabase Cloud: enable via Dashboard → Database → Extensions → pg_cron, pg_net

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove existing job if present (idempotency for re-runs)
select cron.unschedule('retry-pending-quizzes')
where exists (select 1 from cron.job where jobname = 'retry-pending-quizzes');

-- Security note: app.service_role_key is stored as a plain database setting.
-- For production, consider using Supabase Vault to store secrets more securely.
-- Docs: https://supabase.com/docs/guides/database/vault

-- Schedule hourly retry job
-- Note: app.supabase_url and app.service_role_key must be set as database settings
-- in Supabase Cloud: Settings → Database → Configuration → Custom config
select cron.schedule(
  'retry-pending-quizzes',
  '0 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/retry-pending-quizzes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
