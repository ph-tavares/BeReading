-- BER-59: a cota diária do Tavily somava os créditos dos runs iniciados hoje, e um run começado
-- ontem que buscava hoje ficava de fora. `finished_at` marca quando o passo virou `done`/`failed`,
-- para a cota contar os créditos das buscas terminadas no dia. Coluna nula, sem default: os passos
-- antigos não entram na soma, o que só afeta o dia da migração.
alter table public.ingestion_steps add column finished_at timestamptz;

-- BER-59: robustez do worker da ingestão.
--
-- Um passo que mata o worker (estouro do relógio de 150 s da Edge Function, por exemplo) ficava
-- em `running` com trava velha e era reivindicado de novo a cada ciclo, para sempre: a
-- reivindicação não contava tentativa, então `attempts` nunca chegava ao teto da spec §7. Agora a
-- própria reivindicação conta a tentativa, e trava velha que já teve as 4 tentativas (1 + 3
-- retentativas) vira `failed` com `worker_morreu` antes de reivindicar o resto. Tudo numa função,
-- portanto numa transação.
create or replace function public.claim_ingestion_steps(p_limit int, p_stale_before timestamptz)
returns setof public.ingestion_steps
language plpgsql
set search_path = ''
as $$
begin
  update public.ingestion_steps s
     set status = 'failed', error = 'worker_morreu', locked_at = null, finished_at = now()
   where s.status = 'running'
     and s.locked_at < p_stale_before
     and s.attempts >= 4;

  return query
  update public.ingestion_steps s
     set status = 'running', locked_at = now(), attempts = s.attempts + 1
   where s.id in (
     select c.id
       from public.ingestion_steps c
      where (c.status = 'pending' and c.next_attempt_at <= now())
         or (c.status = 'running' and c.locked_at < p_stale_before)
      order by c.next_attempt_at
      limit p_limit
      for update skip locked
   )
  returning s.*;
end;
$$;

-- `create or replace` mantém os privilégios, mas reemite para a migration se sustentar sozinha:
-- só o worker (service_role) reivindica passos.
revoke all on function public.claim_ingestion_steps(int, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_ingestion_steps(int, timestamptz) to service_role;
