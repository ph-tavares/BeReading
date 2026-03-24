-- ============================================================
-- BADGES
-- ============================================================
insert into public.badges (name, description, criteria_type, criteria_value) values
  ('Primeira Página', 'Registrou sua primeira sessão de leitura', 'total_sessions', 1),
  ('Leitor de 7 dias', 'Manteve streak por 7 dias consecutivos', 'streak_days', 7),
  ('Leitor de 30 dias', 'Manteve streak por 30 dias consecutivos', 'streak_days', 30),
  ('Capítulo Completo', 'Completou e respondeu seu primeiro quiz de capítulo', 'quizzes_answered', 1),
  ('Livro Finalizado', 'Finalizou um livro completo', 'books_finished', 1),
  ('Pensador Crítico', 'Obteve score de reflexão acima de 80 em 5 quizzes', 'reflection_score_80', 5),
  ('Devorador de Páginas', 'Leu 500 páginas no total', 'total_pages', 500),
  ('Explorador', 'Está lendo um livro fora da grade escolar', 'personal_book', 1),
  ('Mestre da Compreensão', 'Score médio acima de 90 em um livro completo', 'avg_score_90_book', 1);

-- ============================================================
-- LIVROS DO PILOTO (3 livros para validação com Oliveira)
-- ============================================================

-- Livro 1: O Guia do Mochileiro das Galáxias
insert into public.books (id, title, author, total_pages, genre)
values ('00000000-0000-0000-0001-000000000001', 'O Guia do Mochileiro das Galáxias', 'Douglas Adams', 215, 'Ficção Científica');

insert into public.chapters (book_id, number, title, start_page, end_page) values
  ('00000000-0000-0000-0001-000000000001', 1, 'Capítulo 1', 1, 20),
  ('00000000-0000-0000-0001-000000000001', 2, 'Capítulo 2', 21, 40),
  ('00000000-0000-0000-0001-000000000001', 3, 'Capítulo 3', 41, 60),
  ('00000000-0000-0000-0001-000000000001', 4, 'Capítulo 4', 61, 85),
  ('00000000-0000-0000-0001-000000000001', 5, 'Capítulo 5', 86, 110),
  ('00000000-0000-0000-0001-000000000001', 6, 'Capítulo 6', 111, 140),
  ('00000000-0000-0000-0001-000000000001', 7, 'Capítulo 7', 141, 170),
  ('00000000-0000-0000-0001-000000000001', 8, 'Capítulo 8', 171, 215);

-- Livro 2: 1984
insert into public.books (id, title, author, total_pages, genre)
values ('00000000-0000-0000-0002-000000000002', '1984', 'George Orwell', 328, 'Distopia');

insert into public.chapters (book_id, number, title, start_page, end_page) values
  ('00000000-0000-0000-0002-000000000002', 1, 'Parte 1 - Capítulo 1', 1, 30),
  ('00000000-0000-0000-0002-000000000002', 2, 'Parte 1 - Capítulo 2', 31, 60),
  ('00000000-0000-0000-0002-000000000002', 3, 'Parte 1 - Capítulo 3', 61, 100),
  ('00000000-0000-0000-0002-000000000002', 4, 'Parte 1 - Capítulo 4', 101, 140),
  ('00000000-0000-0000-0002-000000000002', 5, 'Parte 2 - Capítulo 1', 141, 180),
  ('00000000-0000-0000-0002-000000000002', 6, 'Parte 2 - Capítulo 2', 181, 220),
  ('00000000-0000-0000-0002-000000000002', 7, 'Parte 2 - Capítulo 3', 221, 265),
  ('00000000-0000-0000-0002-000000000002', 8, 'Parte 3 - Capítulo 1', 266, 300),
  ('00000000-0000-0000-0002-000000000002', 9, 'Parte 3 - Capítulo 2', 301, 328);

-- Livro 3: Coraline
insert into public.books (id, title, author, total_pages, genre)
values ('00000000-0000-0000-0003-000000000003', 'Coraline', 'Neil Gaiman', 162, 'Fantasia');

insert into public.chapters (book_id, number, title, start_page, end_page) values
  ('00000000-0000-0000-0003-000000000003', 1, 'Capítulo 1', 1, 18),
  ('00000000-0000-0000-0003-000000000003', 2, 'Capítulo 2', 19, 36),
  ('00000000-0000-0000-0003-000000000003', 3, 'Capítulo 3', 37, 54),
  ('00000000-0000-0000-0003-000000000003', 4, 'Capítulo 4', 55, 75),
  ('00000000-0000-0000-0003-000000000003', 5, 'Capítulo 5', 76, 95),
  ('00000000-0000-0000-0003-000000000003', 6, 'Capítulo 6', 96, 115),
  ('00000000-0000-0000-0003-000000000003', 7, 'Capítulo 7', 116, 135),
  ('00000000-0000-0000-0003-000000000003', 8, 'Capítulo 8', 136, 162);

-- Placeholders de chapter_quiz_status para todos os capítulos
insert into public.chapter_quiz_status (chapter_id, status)
select id, 'pending' from public.chapters;
