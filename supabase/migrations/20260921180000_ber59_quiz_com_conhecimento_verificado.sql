-- BER-59: o quiz passa a usar o conhecimento verificado da ingestão (_shared/chapter-grounding.ts).

-- 1. De onde veio o conteúdo do quiz. O generate-questions grava só contagens e domínios das
--    fontes ({fontes, dominios, fatos, status}), nunca o texto de um fato: esta tabela é legível
--    pelo app (policy chapter_quiz_status_public_read), e fato de capítulo é spoiler por natureza
--    (spec §6.4). Null quando o quiz saiu só do texto do catálogo.
alter table public.chapter_quiz_status add column if not exists grounding jsonb;

-- 2. Conhecimento com spoiler conhecido sai de uso. O 7º run do 1984 (8f615823, 18/09/2026)
--    publicou nos capítulos 1 e 9 da edição fatos das Partes 2 e 3 (Sala 101, o livro de
--    Goldstein) — diagnóstico no comentário de 21/09 na BER-59. `insufficient` faz o quiz ignorar
--    o capítulo; `next_recheck_at` nulo impede que a rebusca semanal o pegue sozinha. Os fatos
--    ficam para auditoria, e o próximo run da edição substitui as duas linhas.
update public.chapter_knowledge k
set status = 'insufficient', next_recheck_at = null
from public.edition_chapters c
join public.book_editions e on e.id = c.edition_id
where k.edition_chapter_id = c.id
  and e.isbn = '9788535914849'
  and c.number in (1, 9)
  and k.run_id = '8f615823-2925-47a8-bc58-37c527900c40';
