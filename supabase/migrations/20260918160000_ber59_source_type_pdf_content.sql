-- BER-59: novo tipo de fonte `PDF_content` (spec §11, item 23).
--
-- Texto integral sem sinal de autorização passou a ser aceito com peso B e tipo próprio, em vez de
-- rejeitado. Sem soltar o `check`, todo insert dessas fontes falharia em produção. O tipo separado
-- é o que permite auditar depois quanto do conhecimento veio daí.
alter table public.ingestion_sources drop constraint if exists ingestion_sources_source_type_check;
alter table public.ingestion_sources add constraint ingestion_sources_source_type_check
  check (source_type in (
    'public_domain_text', 'open_license_text', 'bibliographic', 'publisher',
    'encyclopedia', 'editorial', 'web', 'PDF_content'));

alter table public.source_domain_policies drop constraint if exists source_domain_policies_source_type_check;
alter table public.source_domain_policies add constraint source_domain_policies_source_type_check
  check (source_type in (
    'public_domain_text', 'open_license_text', 'bibliographic', 'publisher',
    'encyclopedia', 'editorial', 'web', 'PDF_content'));
