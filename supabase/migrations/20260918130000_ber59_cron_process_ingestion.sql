-- BER-59: agenda o worker da ingestão de conteúdo a cada minuto.
--
-- Mesmo desenho do retry-pending-quizzes (BER-33, BER-84): URL e CRON_SECRET lidos do
-- Vault na hora, nunca escritos em migration. O worker para sozinho antes de 100 s; o
-- timeout de 150 s do pg_net cobre o pior caso sem acumular chamadas. Com a fila vazia a
-- chamada termina em milissegundos. Para desligar sem deploy: secret INGESTION_ENABLED=false
-- nas functions (docs/deploy.md, "Ingestão de conteúdo").

do $do$
declare
  worker_command constant text := $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/process-ingestion',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    );
  $cmd$;
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'process-ingestion';

  if existing_job_id is not null then
    perform cron.alter_job(job_id := existing_job_id, schedule := '* * * * *', command := worker_command, active := true);
  else
    perform cron.schedule('process-ingestion', '* * * * *', worker_command);
  end if;
end
$do$;
