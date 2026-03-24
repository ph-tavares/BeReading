-- Habilitar RLS em todas as tabelas públicas
alter table public.schools enable row level security;
alter table public.classrooms enable row level security;
alter table public.teachers enable row level security;
alter table public.classroom_teachers enable row level security;
alter table public.students enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.book_contents enable row level security;
alter table public.student_books enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.chapter_quiz_status enable row level security;
alter table public.answers enable row level security;
alter table public.streaks enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;
alter table public.classroom_books enable row level security;

-- Helper: retorna o student_id do usuário logado
create or replace function public.get_student_id()
returns uuid language sql security definer stable as $$
  select id from public.students where user_id = auth.uid()
$$;

-- Helper: retorna o teacher_id do usuário logado
create or replace function public.get_teacher_id()
returns uuid language sql security definer stable as $$
  select id from public.teachers where user_id = auth.uid()
$$;

-- Helper: verifica se um livro está na grade da turma do aluno
create or replace function public.is_classroom_book(p_book_id uuid, p_student_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.classroom_books cb
    join public.students s on s.classroom_id = cb.classroom_id
    where cb.book_id = p_book_id and s.id = p_student_id
  )
$$;

-- ============================================================
-- CATÁLOGO: leitura pública (qualquer usuário autenticado)
-- ============================================================
create policy "books_public_read" on public.books
  for select to authenticated using (true);

create policy "chapters_public_read" on public.chapters
  for select to authenticated using (true);

create policy "book_contents_public_read" on public.book_contents
  for select to authenticated using (true);

create policy "badges_public_read" on public.badges
  for select to authenticated using (true);

create policy "questions_public_read" on public.questions
  for select to authenticated using (true);

create policy "chapter_quiz_status_public_read" on public.chapter_quiz_status
  for select to authenticated using (true);

-- ============================================================
-- ALUNO: apenas seus próprios dados
-- ============================================================

create policy "student_books_own" on public.student_books
  for all to authenticated
  using (student_id = public.get_student_id())
  with check (student_id = public.get_student_id());

create policy "reading_sessions_own" on public.reading_sessions
  for all to authenticated
  using (student_id = public.get_student_id())
  with check (student_id = public.get_student_id());

create policy "answers_own" on public.answers
  for all to authenticated
  using (student_id = public.get_student_id())
  with check (student_id = public.get_student_id());

create policy "streaks_own" on public.streaks
  for all to authenticated
  using (student_id = public.get_student_id())
  with check (student_id = public.get_student_id());

create policy "student_badges_own" on public.student_badges
  for all to authenticated
  using (student_id = public.get_student_id())
  with check (student_id = public.get_student_id());

-- Aluno vê a si mesmo
create policy "students_own_read" on public.students
  for select to authenticated
  using (user_id = auth.uid());

-- Aluno vê sua turma
create policy "classrooms_student_read" on public.classrooms
  for select to authenticated
  using (
    id = (select classroom_id from public.students where user_id = auth.uid())
  );

-- Aluno vê livros da grade da sua turma
create policy "classroom_books_student_read" on public.classroom_books
  for select to authenticated
  using (
    classroom_id = (select classroom_id from public.students where user_id = auth.uid())
  );

-- Aluno vê a escola da sua turma
create policy "schools_student_read" on public.schools
  for select to authenticated
  using (
    id = (select cl.school_id from public.classrooms cl
          join public.students s on s.classroom_id = cl.id
          where s.user_id = auth.uid())
  );

-- ============================================================
-- PROFESSOR: dados das suas turmas, apenas livros da grade
-- ============================================================

-- Professor vê e edita seus próprios dados
create policy "teachers_own" on public.teachers
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Professor vê alunos das suas turmas
create policy "students_teacher_read" on public.students
  for select to authenticated
  using (
    classroom_id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- Professor vê e gerencia suas turmas
create policy "classrooms_teacher_read" on public.classrooms
  for select to authenticated
  using (
    id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

create policy "classrooms_teacher_insert" on public.classrooms
  for insert to authenticated
  with check (
    school_id = (select school_id from public.teachers where user_id = auth.uid())
  );

-- Professor gerencia vínculos professor-turma
create policy "classroom_teachers_teacher" on public.classroom_teachers
  for all to authenticated
  using (teacher_id = public.get_teacher_id())
  with check (teacher_id = public.get_teacher_id());

-- Professor gerencia livros das suas turmas
create policy "classroom_books_teacher" on public.classroom_books
  for all to authenticated
  using (
    classroom_id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  )
  with check (
    classroom_id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- Professor vê ReadingSessions APENAS para livros da grade
create policy "reading_sessions_teacher_read" on public.reading_sessions
  for select to authenticated
  using (
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
    and public.is_classroom_book(book_id, student_id)
  );

-- Professor vê Answers APENAS para livros da grade
create policy "answers_teacher_read" on public.answers
  for select to authenticated
  using (
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
    and public.is_classroom_book(
      (select c.book_id from public.chapters c
       join public.questions q on q.chapter_id = c.id
       where q.id = question_id),
      student_id
    )
  );

-- Professor vê Streaks dos seus alunos (streak geral, não por livro)
create policy "streaks_teacher_read" on public.streaks
  for select to authenticated
  using (
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- Professor vê a escola onde está vinculado
create policy "schools_teacher_read" on public.schools
  for select to authenticated
  using (
    id = (select school_id from public.teachers where user_id = auth.uid())
  );
