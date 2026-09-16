-- BER-59: base da ingestão de conteúdo de capítulo por ISBN.
-- Spec: docs/superpowers/specs/2026-09-16-ber-59-ingestao-conteudo-capitulo-design.md
--
-- Nada aqui é lido pelo app. Fato de capítulo é spoiler por natureza (spec §6.4):
-- se o cliente pudesse ler, qualquer leitor veria o que acontece adiante. Por isso
-- RLS ligado SEM policy e privilégios de anon/authenticated revogados; a asserção
-- no fim reprova a migration se alguém mudar isso.

create table public.book_editions (
  id uuid primary key default extensions.uuid_generate_v4(),
  isbn text not null unique check (isbn ~ '^(\d{9}[\dX]|\d{13})$'),
  title text,
  authors text[] not null default '{}',
  publisher text,
  language text,
  publish_year int,
  first_publish_year int,
  work_key text,
  original_language text,
  author_death_year int,
  book_id uuid references public.books(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.edition_chapters (
  id uuid primary key default extensions.uuid_generate_v4(),
  edition_id uuid not null references public.book_editions(id) on delete cascade,
  number int not null check (number >= 1),
  part_label text,
  number_in_part int,
  title text,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (edition_id, number)
);

create table public.ingestion_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  edition_id uuid not null references public.book_editions(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
  status_reason text,
  payload jsonb not null default '{}',
  stats jsonb not null default '{}',
  structure_divergence jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.ingestion_steps (
  id uuid primary key default extensions.uuid_generate_v4(),
  run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  kind text not null
    check (kind in ('edition', 'discover', 'fetch', 'extract', 'structure', 'verify', 'publish')),
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  error text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, kind, subject)
);

create index idx_ingestion_steps_claimable
  on public.ingestion_steps (next_attempt_at)
  where status in ('pending', 'running');

create table public.source_domain_policies (
  domain text primary key,
  policy text not null check (policy in ('allowed', 'blocked')),
  weight text check (weight in ('A', 'B', 'C', 'D')),
  source_type text check (source_type in (
    'public_domain_text', 'open_license_text', 'bibliographic', 'publisher',
    'encyclopedia', 'editorial', 'web')),
  authorizes_full_text boolean not null default false,
  host_country text,
  reason text not null,
  updated_at timestamptz not null default now(),
  check (policy = 'blocked' or (weight is not null and source_type is not null))
);

create table public.ingestion_sources (
  id uuid primary key default extensions.uuid_generate_v4(),
  run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  url text not null,
  final_url text,
  registrable_domain text,
  title text,
  source_type text check (source_type in (
    'public_domain_text', 'open_license_text', 'bibliographic', 'publisher',
    'encyclopedia', 'editorial', 'web')),
  weight text check (weight in ('A', 'B', 'C', 'D')),
  decision text not null check (decision in ('accepted', 'rejected')),
  rejection_reason text,
  public_domain_basis text,
  is_book_file boolean not null default false,
  tied_to_isbn boolean not null default false,
  content_fingerprint text,
  independence_group text,
  declared_structure jsonb,
  fetched_at timestamptz not null default now(),
  unique (run_id, url)
);

create table public.ingestion_source_texts (
  source_id uuid primary key references public.ingestion_sources(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.ingestion_claims (
  id uuid primary key default extensions.uuid_generate_v4(),
  run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source_id uuid not null references public.ingestion_sources(id) on delete cascade,
  chapter_ref jsonb,
  edition_chapter_id uuid references public.edition_chapters(id) on delete set null,
  kind text not null check (kind in ('event', 'character', 'relationship', 'argument', 'theme')),
  statement text not null check (char_length(statement) between 1 and 240),
  is_interpretation boolean not null default false,
  forward_reference boolean not null default false,
  located boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_ingestion_claims_run on public.ingestion_claims (run_id);
create index idx_ingestion_claims_chapter on public.ingestion_claims (edition_chapter_id);

create table public.chapter_knowledge (
  id uuid primary key default extensions.uuid_generate_v4(),
  edition_chapter_id uuid not null unique references public.edition_chapters(id) on delete cascade,
  -- BER-59: runs são auditoria permanente; conhecimento publicado não pode sumir junto — apagar um run que ainda sustenta conhecimento tem que falhar alto.
  run_id uuid not null references public.ingestion_runs(id) on delete restrict,
  status text not null check (status in ('confirmed', 'partial', 'insufficient')),
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  summary text not null default '',
  recheck_count int not null default 0,
  next_recheck_at timestamptz,
  published_at timestamptz not null default now()
);

create table public.chapter_facts (
  id uuid primary key default extensions.uuid_generate_v4(),
  chapter_knowledge_id uuid not null references public.chapter_knowledge(id) on delete cascade,
  kind text not null check (kind in ('event', 'character', 'relationship', 'argument', 'theme')),
  statement text not null check (char_length(statement) between 1 and 240),
  is_interpretation boolean not null default false,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  independent_support int not null check (independent_support >= 1)
);

create table public.chapter_fact_sources (
  fact_id uuid not null references public.chapter_facts(id) on delete cascade,
  -- BER-59: sources são auditoria permanente; proveniência de fato publicado não pode sumir junto — apagar uma source que ainda sustenta fato tem que falhar alto.
  source_id uuid not null references public.ingestion_sources(id) on delete restrict,
  primary key (fact_id, source_id)
);

-- Fila: reivindica passos prontos ou com trava velha (worker que morreu), sem que
-- duas execuções do worker peguem o mesmo passo.
create function public.claim_ingestion_steps(p_limit int, p_stale_before timestamptz)
returns setof public.ingestion_steps
language sql
set search_path = ''
as $$
  update public.ingestion_steps s
     set status = 'running', locked_at = now()
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
$$;

-- Soma contadores numéricos no jsonb do run numa instrução só: duas execuções do
-- worker podem terminar passos do mesmo run ao mesmo tempo.
create function public.increment_ingestion_run_stats(p_run_id uuid, p_delta jsonb)
returns void
language sql
set search_path = ''
as $$
  update public.ingestion_runs r
     set stats = coalesce((
       select jsonb_object_agg(
                k,
                coalesce((r.stats ->> k)::numeric, 0) + coalesce((p_delta ->> k)::numeric, 0))
         from (select jsonb_object_keys(r.stats) as k
               union
               select jsonb_object_keys(p_delta)) keys
     ), '{}'::jsonb)
   where r.id = p_run_id;
$$;

revoke all on function public.claim_ingestion_steps(int, timestamptz) from public, anon, authenticated;
revoke all on function public.increment_ingestion_run_stats(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_ingestion_steps(int, timestamptz) to service_role;
grant execute on function public.increment_ingestion_run_stats(uuid, jsonb) to service_role;

insert into public.source_domain_policies
  (domain, policy, weight, source_type, authorizes_full_text, host_country, reason)
values
  ('gutenberg.org', 'allowed', 'A', 'public_domain_text', true, 'US', 'Project Gutenberg: só publica obra em domínio público nos EUA'),
  ('gutenberg.net.au', 'allowed', 'A', 'public_domain_text', true, 'AU', 'Project Gutenberg Australia: domínio público na Austrália'),
  ('gutenberg.ca', 'allowed', 'A', 'public_domain_text', true, 'CA', 'Faded Page / Gutenberg Canada: domínio público no Canadá'),
  ('dominiopublico.gov.br', 'allowed', 'A', 'public_domain_text', true, 'BR', 'Portal Domínio Público (MEC)'),
  ('wikisource.org', 'allowed', 'A', 'public_domain_text', true, 'US', 'Wikisource: textos em domínio público ou licença livre'),
  ('scielo.org', 'allowed', 'A', 'open_license_text', true, 'BR', 'SciELO Livros: acesso aberto'),
  ('openlibrary.org', 'allowed', 'B', 'bibliographic', false, 'US', 'Base bibliográfica aberta'),
  ('google.com', 'allowed', 'B', 'bibliographic', false, 'US', 'Google Books (metadado)'),
  ('wikipedia.org', 'allowed', 'B', 'encyclopedia', false, 'US', 'Enciclopédia, CC BY-SA'),
  ('archive.org', 'allowed', 'C', 'editorial', false, 'US', 'Acervo misto: texto integral só com regra de domínio público'),
  ('amazon.com', 'blocked', null, null, false, null, 'Termos proíbem acesso automatizado'),
  ('amazon.com.br', 'blocked', null, null, false, null, 'Termos proíbem acesso automatizado'),
  ('goodreads.com', 'blocked', null, null, false, null, 'Termos proíbem acesso automatizado'),
  ('libgen.is', 'blocked', null, null, false, null, 'Biblioteca pirata'),
  ('libgen.rs', 'blocked', null, null, false, null, 'Biblioteca pirata'),
  ('libgen.li', 'blocked', null, null, false, null, 'Biblioteca pirata'),
  ('z-lib.org', 'blocked', null, null, false, null, 'Biblioteca pirata'),
  ('annas-archive.org', 'blocked', null, null, false, null, 'Biblioteca pirata'),
  ('pdfdrive.com', 'blocked', null, null, false, null, 'Distribuição de PDF sem autorização');

do $$
declare
  t text;
  ingestion_tables constant text[] := array[
    'book_editions', 'edition_chapters', 'ingestion_runs', 'ingestion_steps',
    'source_domain_policies', 'ingestion_sources', 'ingestion_source_texts',
    'ingestion_claims', 'chapter_knowledge', 'chapter_facts', 'chapter_fact_sources'];
begin
  foreach t in array ingestion_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;

  foreach t in array ingestion_tables loop
    if not (select c.relrowsecurity from pg_class c where c.oid = format('public.%I', t)::regclass) then
      raise exception 'BER-59: RLS desligado em public.%', t;
    end if;
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t) then
      raise exception 'BER-59: public.% não pode ter policy; o app não lê a ingestão', t;
    end if;
    if has_table_privilege('anon', format('public.%I', t), 'select')
       or has_table_privilege('authenticated', format('public.%I', t), 'select') then
      raise exception 'BER-59: anon/authenticated ainda leem public.%', t;
    end if;
  end loop;
end
$$;
