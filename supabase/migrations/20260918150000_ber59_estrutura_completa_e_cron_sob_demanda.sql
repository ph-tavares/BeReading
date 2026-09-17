-- BER-59: correções do primeiro teste em produção (1984, 17/09/2026).

-- A extração passa a dizer se a fonte lista todos os capítulos do livro. Lista parcial (página de
-- um capítulo, índice lido pela metade) só apoia os capítulos que traz; contada como lista inteira,
-- ela aparecia como edição rival e impedia a confirmação da estrutura (spec §11, item 24).
alter table public.ingestion_sources
  add column declared_structure_complete boolean not null default false;

-- A Edge Function morre aos 2 s de CPU por chamada, então o worker faz menos por chamada (lotes de
-- PDF, orçamento de CPU) e passa a ser chamado a cada 20 s em vez de a cada minuto. Para não
-- multiplicar chamadas vazias, o cron só chama quando há o que fazer: passo pronto ou com trava
-- velha, ou run aberto (a recuperação de run parado roda dentro do worker). A limpeza de texto
-- vencido e o agendamento de rebusca também rodam dentro do worker, então uma chamada a cada 10
-- minutos acontece mesmo com a fila vazia (spec §11, item 26).
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
    )
    where exists (
            select 1 from public.ingestion_steps
             where (status = 'pending' and next_attempt_at <= now())
                or (status = 'running' and locked_at < now() - interval '5 minutes')
          )
       or exists (select 1 from public.ingestion_runs where status in ('queued', 'running'))
       or (extract(minute from now())::int % 10 = 0 and extract(second from now()) < 20);
  $cmd$;
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'process-ingestion';

  if existing_job_id is not null then
    perform cron.alter_job(job_id := existing_job_id, schedule := '20 seconds', command := worker_command, active := true);
  else
    perform cron.schedule('process-ingestion', '20 seconds', worker_command);
  end if;
end
$do$;
