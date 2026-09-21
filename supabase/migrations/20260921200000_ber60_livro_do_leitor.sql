-- BER-60: o leitor cadastra um livro que não está no catálogo.
--
-- Até aqui `books` só recebia linha por migration de seed: 3 livros, e nenhum
-- `insert` em todo o app. Quem chegava com outro livro na mão não tinha o que
-- registrar.
--
-- O livro do leitor é dele: `added_by` guarda quem cadastrou, e só essa pessoa
-- enxerga o livro (e os capítulos). O catálogo continua sendo `added_by is null`,
-- visível para todo mundo. Motivo de não publicar o cadastro para todos: título,
-- autor e capítulos vêm do que o leitor digitou, sem revisão de ninguém, e o
-- catálogo apareceria para todos os outros leitores com o texto que um só escreveu.
--
-- `on delete cascade`: apagar a conta (delete-account) leva junto os livros que a
-- pessoa cadastrou, com capítulos, sessões e perguntas (as FKs de `chapters`,
-- `reading_sessions` e `student_books` para `books` já são cascade).
--
-- `isbn` fica em `books` para o mesmo leitor não cadastrar a mesma edição duas vezes
-- e para ligar o livro à ingestão (BER-59, `book_editions.book_id`).

alter table public.books
  add column isbn text,
  add column added_by uuid references auth.users (id) on delete cascade;

comment on column public.books.added_by is
  'BER-60: quem cadastrou o livro. NULL = livro do catálogo, visível para todos.';
comment on column public.books.isbn is
  'BER-60: ISBN-10 ou ISBN-13 normalizado (sem hífen). Opcional.';

-- Um ISBN aparece uma vez no catálogo, e uma vez por leitor.
create unique index books_catalog_isbn_key on public.books (isbn)
  where added_by is null and isbn is not null;
create unique index books_reader_isbn_key on public.books (added_by, isbn)
  where added_by is not null and isbn is not null;
create index books_added_by_idx on public.books (added_by)
  where added_by is not null;

-- Leitura: catálogo para todos, livro do leitor só para ele. A escrita continua
-- sem policy nenhuma: quem grava é a Edge Function add-book, com service_role.
drop policy books_public_read on public.books;
create policy books_read on public.books for select to authenticated
  using (added_by is null or added_by = (select auth.uid()));

-- Capítulo segue o livro. O `exists` consulta `books` com a RLS de quem lê, então
-- capítulo de livro que a pessoa não enxerga também não aparece.
drop policy chapters_public_read on public.chapters;
create policy chapters_read on public.chapters for select to authenticated
  using (exists (select 1 from public.books b where b.id = chapters.book_id));
