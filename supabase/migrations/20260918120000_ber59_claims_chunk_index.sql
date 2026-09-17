-- BER-59: um passo `extract` reexecutado (spec §7 permite até 3 tentativas) não pode duplicar
-- as afirmações do bloco que já tinha inserido antes de falhar. `chunk_index` identifica de qual
-- bloco de texto da fonte vieram as afirmações, para o passo apagar as do bloco antes de reinserir
-- em vez de só acrescentar. A tabela já está com RLS ligado sem policy (migration anterior); esta
-- migration não mexe em RLS nem em grant.
alter table public.ingestion_claims add column chunk_index int;

create index idx_ingestion_claims_source_chunk on public.ingestion_claims (source_id, chunk_index);
