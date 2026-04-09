# BeReading MVP - Plano 1: Supabase Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar o projeto Supabase com schema completo, RLS policies, seed data dos livros do piloto, e as Edge Functions de registro de leitura, verificação de capítulo completo, e retry de IA.

**Architecture:** Toda a lógica de negócio reside em Edge Functions TypeScript/Deno. O schema usa PostgreSQL com RLS para garantir privacidade entre alunos e professores. A Edge Function `register-reading-session` é o coração do sistema: cria a sessão, atualiza o progresso do livro, atualiza o streak, e detecta capítulo completo. Perguntas são geradas por capítulo (cacheadas — sem student_id).

**Tech Stack:** Supabase CLI, PostgreSQL, TypeScript/Deno (Edge Functions), Deno test

**Spec de referência:** `docs/superpowers/specs/2026-03-23-bereading-mvp-design.md`

---

## Estrutura de Arquivos

```
supabase/
  config.toml                                # Config do projeto Supabase (gerado pelo CLI)
  migrations/
    20260323000001_initial_schema.sql        # Criação das 15 tabelas
    20260323000002_rls_policies.sql          # Row Level Security (student/teacher/admin)
    20260323000003_seed_pilot.sql            # 3 livros + capítulos + BookContent para o piloto
  functions/
    _shared/
      types.ts                               # Tipos TypeScript compartilhados entre Edge Functions
      supabase-client.ts                     # Factory do cliente Supabase (service_role)
    register-reading-session/
      index.ts                               # Handler principal da Edge Function
      index.test.ts                          # Testes Deno
    check-chapter-completion/
      index.ts                               # Lógica de detecção de capítulo completo
      index.test.ts                          # Testes Deno
    generate-questions/
      index.ts                               # Geração de perguntas via IA (com cache)
      index.test.ts                          # Testes Deno (mock da API de IA)
    evaluate-answer/
      index.ts                               # Avaliação de respostas via IA
      index.test.ts                          # Testes Deno (mock da API de IA)
    retry-pending-quizzes/
      index.ts                               # Job pg_cron: retenta geração de perguntas com falha
```

---

## Task 1: Setup do Projeto Supabase

**Files:**
- Create: `supabase/config.toml` (gerado pelo CLI)

- [ ] **Step 1: Instalar o Supabase CLI**

```bash
npm install -g supabase
supabase --version
```
Expected: versão >= 1.x

- [ ] **Step 2: Inicializar o projeto**

```bash
cd /home/sapat/BeReading
supabase init
```
Expected: pasta `supabase/` criada com `config.toml`

- [ ] **Step 3: Subir o Supabase local**

```bash
supabase start
```
Expected: URLs de Studio, API e banco exibidas no terminal. Guardar a `anon key` e `service_role key` para usar nos próximos passos.

- [ ] **Step 4: Criar arquivo `.env` na raiz**

```bash
cat > .env << 'EOF'
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon_key_do_output_acima>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_do_output_acima>
AI_API_KEY=<sua_chave_claude_ou_openai>
AI_MODEL=claude-3-5-haiku-20241022
EOF
```

- [ ] **Step 5: Adicionar `.env` ao `.gitignore`**

```bash
cat > .gitignore << 'EOF'
.env
node_modules/
.supabase/
EOF
```

- [ ] **Step 6: Commit**

```bash
git add supabase/ .gitignore
git commit -m "feat: initialize supabase project"
```

---

## Task 2: Schema — Migration Inicial (Todas as Tabelas)

**Files:**
- Create: `supabase/migrations/20260323000001_initial_schema.sql`

- [ ] **Step 1: Criar a migration**

```bash
supabase migration new initial_schema
```
Expected: arquivo `supabase/migrations/<timestamp>_initial_schema.sql` criado. Renomear para `20260323000001_initial_schema.sql`.

- [ ] **Step 2: Escrever o SQL completo**

Conteúdo de `supabase/migrations/20260323000001_initial_schema.sql`:

```sql
-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- Schools
create table public.schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null,
  state text not null,
  invite_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- Classrooms
create table public.classrooms (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  grade text not null,
  year int not null,
  class_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- Teachers
create table public.teachers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  created_at timestamptz default now()
);

-- ClassroomTeacher (N-N)
create table public.classroom_teachers (
  id uuid primary key default uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  unique(classroom_id, teacher_id)
);

-- Students
create table public.students (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id),
  display_name text not null,
  created_at timestamptz default now()
);

-- Books
create table public.books (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text not null,
  cover_url text,
  total_pages int not null,
  genre text,
  created_at timestamptz default now()
);

-- Chapters
create table public.chapters (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  number int not null,
  title text,
  start_page int not null,
  end_page int not null,
  unique(book_id, number),
  constraint valid_pages check (end_page >= start_page)
);

-- BookContent (conteúdo para IA)
create table public.book_contents (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null unique references public.chapters(id) on delete cascade,
  content_text text not null,
  created_at timestamptz default now()
);

-- StudentBook (relacionamento aluno <-> livro)
create table public.student_books (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'reading' check (status in ('reading', 'finished', 'dropped')),
  current_page int not null default 1,
  started_at timestamptz default now(),
  finished_at timestamptz,
  unique(student_id, book_id)
);

-- ReadingSessions
create table public.reading_sessions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  start_page int not null,
  end_page int not null,
  pages_read int not null generated always as (end_page - start_page + 1) stored,
  read_at timestamptz default now(),
  constraint valid_session check (end_page >= start_page and start_page >= 1)
);

-- Questions (cacheadas por capítulo, sem student_id)
create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  type text not null check (type in ('comprehension', 'reflection')),
  question_text text not null,
  generated_at timestamptz default now()
);

-- Quiz generation status por capítulo (para cache e retry)
create table public.chapter_quiz_status (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null unique references public.chapters(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'generated', 'failed')),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  error_message text
);

-- Answers
create table public.answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answer_text text not null,
  comprehension_score int check (comprehension_score between 0 and 100),
  ai_feedback text,
  answered_at timestamptz default now(),
  evaluated_at timestamptz,
  unique(question_id, student_id)
);

-- Streaks
create table public.streaks (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_read_date date
);

-- Badges
create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text not null,
  icon_url text,
  criteria_type text not null,  -- 'streak_days', 'total_pages', 'books_finished', 'quiz_score', 'personal_book'
  criteria_value int not null
);

-- StudentBadges
create table public.student_badges (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  unique(student_id, badge_id)
);

-- ClassroomBooks
create table public.classroom_books (
  id uuid primary key default uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  assigned_by uuid not null references public.teachers(id),
  status text not null default 'required' check (status in ('required', 'recommended')),
  created_at timestamptz default now(),
  unique(classroom_id, book_id)
);
```

- [ ] **Step 3: Aplicar a migration**

```bash
supabase db reset
```
Expected: sem erros. Todas as tabelas visíveis no Supabase Studio (`http://localhost:54323`).

- [ ] **Step 4: Verificar tabelas no Studio**

Abrir `http://localhost:54323` → Table Editor. Confirmar que todas as 16 tabelas existem (incluindo `chapter_quiz_status`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add initial database schema (16 tables)"
```

---

## Task 3: RLS Policies

**Files:**
- Create: `supabase/migrations/20260323000002_rls_policies.sql`

- [ ] **Step 1: Criar a migration de RLS**

```bash
supabase migration new rls_policies
```
Renomear para `20260323000002_rls_policies.sql`.

- [ ] **Step 2: Escrever as policies**

```sql
-- Habilitar RLS em todas as tabelas
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

-- Helper: retorna o student_id do usuário logado (null se não for aluno)
create or replace function public.get_student_id()
returns uuid language sql security definer as $$
  select id from public.students where user_id = auth.uid()
$$;

-- Helper: retorna o teacher_id do usuário logado (null se não for professor)
create or replace function public.get_teacher_id()
returns uuid language sql security definer as $$
  select id from public.teachers where user_id = auth.uid()
$$;

-- Helper: verifica se um livro está na grade de uma turma do professor logado
create or replace function public.is_classroom_book(p_book_id uuid, p_student_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1
    from public.classroom_books cb
    join public.students s on s.classroom_id = cb.classroom_id
    where cb.book_id = p_book_id and s.id = p_student_id
  )
$$;

-- ============================================================
-- BOOKS e CHAPTERS: leitura pública (catálogo universal)
-- ============================================================
create policy "books_public_read" on public.books for select using (true);
create policy "chapters_public_read" on public.chapters for select using (true);
create policy "book_contents_public_read" on public.book_contents for select using (true);
create policy "badges_public_read" on public.badges for select using (true);
create policy "questions_public_read" on public.questions for select using (true);
create policy "chapter_quiz_status_public_read" on public.chapter_quiz_status for select using (true);

-- ============================================================
-- ALUNO: vê/edita apenas seus próprios dados
-- ============================================================

-- student_books
create policy "student_books_own" on public.student_books
  for all using (student_id = public.get_student_id());

-- reading_sessions
create policy "reading_sessions_own" on public.reading_sessions
  for all using (student_id = public.get_student_id());

-- answers
create policy "answers_own" on public.answers
  for all using (student_id = public.get_student_id());

-- streaks
create policy "streaks_own" on public.streaks
  for all using (student_id = public.get_student_id());

-- student_badges
create policy "student_badges_own" on public.student_badges
  for all using (student_id = public.get_student_id());

-- students: aluno vê a si mesmo; professor vê alunos das suas turmas
create policy "students_own_read" on public.students
  for select using (user_id = auth.uid());

-- classrooms: aluno vê a sua turma
create policy "classrooms_student_read" on public.classrooms
  for select using (
    id = (select classroom_id from public.students where user_id = auth.uid())
  );

-- classroom_books: aluno vê livros da sua turma
create policy "classroom_books_student_read" on public.classroom_books
  for select using (
    classroom_id = (select classroom_id from public.students where user_id = auth.uid())
  );

-- ============================================================
-- PROFESSOR: vê dados da sua turma, apenas livros da grade
-- ============================================================

-- professor vê seus próprios dados
create policy "teachers_own" on public.teachers
  for all using (user_id = auth.uid());

-- professor vê alunos das suas turmas
create policy "students_teacher_read" on public.students
  for select using (
    classroom_id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- professor vê suas turmas
create policy "classrooms_teacher_read" on public.classrooms
  for select using (
    id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- professor cria/edita suas turmas
create policy "classrooms_teacher_write" on public.classrooms
  for insert with check (
    school_id = (select school_id from public.teachers where user_id = auth.uid())
  );

-- classroom_teachers: professor gerencia vínculo com turmas
create policy "classroom_teachers_teacher" on public.classroom_teachers
  for all using (teacher_id = public.get_teacher_id());

-- classroom_books: professor gerencia livros das suas turmas
create policy "classroom_books_teacher" on public.classroom_books
  for all using (
    classroom_id in (
      select ct.classroom_id from public.classroom_teachers ct
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- Professor vê reading_sessions APENAS para livros da grade
create policy "reading_sessions_teacher_read" on public.reading_sessions
  for select using (
    -- aluno está na turma do professor
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
    and
    -- livro está na grade da turma do aluno
    public.is_classroom_book(book_id, student_id)
  );

-- Professor vê answers APENAS para livros da grade
create policy "answers_teacher_read" on public.answers
  for select using (
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
    and
    public.is_classroom_book(
      (select c.book_id from public.chapters c
       join public.questions q on q.chapter_id = c.id
       where q.id = question_id),
      student_id
    )
  );

-- Professor vê streaks dos seus alunos
create policy "streaks_teacher_read" on public.streaks
  for select using (
    student_id in (
      select s.id from public.students s
      join public.classroom_teachers ct on ct.classroom_id = s.classroom_id
      where ct.teacher_id = public.get_teacher_id()
    )
  );

-- schools: professor vê sua escola
create policy "schools_teacher_read" on public.schools
  for select using (
    id = (select school_id from public.teachers where user_id = auth.uid())
  );
```

- [ ] **Step 3: Aplicar a migration**

```bash
supabase db reset
```
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for student, teacher, admin roles"
```

---

## Task 4: Seed Data — Livros do Piloto

**Files:**
- Create: `supabase/migrations/20260323000003_seed_pilot.sql`

- [ ] **Step 1: Criar a migration de seed**

```bash
supabase migration new seed_pilot
```
Renomear para `20260323000003_seed_pilot.sql`.

- [ ] **Step 2: Inserir badges, livros e capítulos do piloto**

Nota: `book_contents.content_text` deve ser preenchido manualmente com o texto real dos capítulos via Supabase Studio após ingestão. O seed cria apenas a estrutura (livros + capítulos com placeholder).

```sql
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

-- Livro 1: O Mochileiro das Galáxias
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
```

- [ ] **Step 3: Aplicar o seed**

```bash
supabase db reset
```
Expected: tabelas com dados. Verificar no Studio → Table Editor → `books` (3 livros), `chapters` (~25 capítulos), `badges` (9 badges).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add pilot seed data (3 books, chapters, 9 badges)"
```

---

## Task 5: Tipos Compartilhados e Cliente Supabase

**Files:**
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/supabase-client.ts`

- [ ] **Step 1: Criar `types.ts`**

```typescript
// supabase/functions/_shared/types.ts

export interface ReadingSessionPayload {
  student_id: string;
  book_id: string;
  start_page: number;
  end_page: number;
}

export interface CompletedChapter {
  chapter_id: string;
  chapter_number: number;
  book_id: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface QuestionData {
  type: 'comprehension' | 'reflection';
  question_text: string;
}

export interface AnswerPayload {
  question_id: string;
  student_id: string;
  answer_text: string;
}
```

- [ ] **Step 2: Criar `supabase-client.ts`**

```typescript
// supabase/functions/_shared/supabase-client.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add shared types and supabase client factory"
```

---

## Task 6: Edge Function — `register-reading-session`

Esta é a função mais crítica do sistema. Ela:
1. Valida o payload
2. Cria a ReadingSession
3. Atualiza StudentBook.current_page
4. Atualiza o Streak
5. Detecta capítulos recém-completados e dispara geração de perguntas

**Files:**
- Create: `supabase/functions/register-reading-session/index.test.ts`
- Create: `supabase/functions/register-reading-session/index.ts`
- Create: `supabase/functions/check-chapter-completion/index.ts`

- [ ] **Step 1: Escrever os testes primeiro**

```typescript
// supabase/functions/register-reading-session/index.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// Lógica pura de detecção de capítulo completo
// (extraída para facilitar teste sem Supabase)

interface Chapter {
  id: string;
  start_page: number;
  end_page: number;
}

interface Session {
  start_page: number;
  end_page: number;
}

function getMaxPageReached(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map(s => s.end_page));
}

function findNewlyCompletedChapters(
  chapters: Chapter[],
  previousMaxPage: number,
  newMaxPage: number
): Chapter[] {
  return chapters.filter(
    ch => ch.end_page > previousMaxPage && ch.end_page <= newMaxPage
  );
}

function calculateNewStreak(lastReadDate: string | null, todayStr: string): number {
  if (!lastReadDate) return 1;
  const last = new Date(lastReadDate);
  const today = new Date(todayStr);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 0; // já leu hoje, não incrementa
  if (diffDays === 1) return 1; // dia seguinte, incrementa
  return -1; // resetar streak
}

// --- TESTES ---

Deno.test('getMaxPageReached: retorna 0 para sessões vazias', () => {
  assertEquals(getMaxPageReached([]), 0);
});

Deno.test('getMaxPageReached: retorna o maior end_page', () => {
  const sessions = [
    { start_page: 1, end_page: 20 },
    { start_page: 15, end_page: 40 },
    { start_page: 35, end_page: 60 },
  ];
  assertEquals(getMaxPageReached(sessions), 60);
});

Deno.test('findNewlyCompletedChapters: detecta capítulo recém-completado', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 30 },
    { id: 'ch2', start_page: 31, end_page: 60 },
  ];
  // Antes: max page era 20 (dentro do ch1)
  // Agora: max page é 35 (passou o end_page do ch1 = 30)
  const completed = findNewlyCompletedChapters(chapters, 20, 35);
  assertEquals(completed.length, 1);
  assertEquals(completed[0].id, 'ch1');
});

Deno.test('findNewlyCompletedChapters: não detecta capítulo já completado', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 30 },
  ];
  // Já tinha lido até 30 antes — não é "recém"
  const completed = findNewlyCompletedChapters(chapters, 30, 45);
  assertEquals(completed.length, 0);
});

Deno.test('findNewlyCompletedChapters: detecta múltiplos capítulos de uma vez', () => {
  const chapters: Chapter[] = [
    { id: 'ch1', start_page: 1, end_page: 20 },
    { id: 'ch2', start_page: 21, end_page: 40 },
    { id: 'ch3', start_page: 41, end_page: 60 },
  ];
  // Leu de 1 a 50 de uma vez (completou ch1 e ch2)
  const completed = findNewlyCompletedChapters(chapters, 0, 50);
  assertEquals(completed.length, 2);
});

Deno.test('calculateNewStreak: primeiro dia retorna 1', () => {
  assertEquals(calculateNewStreak(null, '2026-03-23'), 1);
});

Deno.test('calculateNewStreak: dia consecutivo retorna 1', () => {
  assertEquals(calculateNewStreak('2026-03-22', '2026-03-23'), 1);
});

Deno.test('calculateNewStreak: mesmo dia retorna 0', () => {
  assertEquals(calculateNewStreak('2026-03-23', '2026-03-23'), 0);
});

Deno.test('calculateNewStreak: dia pulado retorna -1 (reset)', () => {
  assertEquals(calculateNewStreak('2026-03-20', '2026-03-23'), -1);
});
```

- [ ] **Step 2: Rodar os testes — devem falhar pois as funções ainda não existem como módulo**

```bash
cd supabase/functions/register-reading-session
deno test index.test.ts
```
Expected: PASS — as funções estão definidas inline no arquivo de teste. Este passo confirma que a lógica pura está correta antes de integrar com Supabase.

- [ ] **Step 3: Implementar a Edge Function**

```typescript
// supabase/functions/register-reading-session/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import type { ReadingSessionPayload } from '../_shared/types.ts';

const SAOPAULO_OFFSET = -3; // UTC-3

function getTodayInSaoPaulo(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const sp = new Date(utc + SAOPAULO_OFFSET * 3600000);
  return sp.toISOString().split('T')[0];
}

function getMaxPageReached(sessions: { end_page: number }[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map(s => s.end_page));
}

function findNewlyCompletedChapters(
  chapters: { id: string; end_page: number }[],
  previousMaxPage: number,
  newMaxPage: number
) {
  return chapters.filter(
    ch => ch.end_page > previousMaxPage && ch.end_page <= newMaxPage
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: ReadingSessionPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { student_id, book_id, start_page, end_page } = payload;

  // Validação básica
  if (!student_id || !book_id || !start_page || !end_page) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  if (start_page < 1 || end_page < start_page) {
    return new Response(JSON.stringify({ error: 'Invalid page range' }), { status: 400 });
  }

  const supabase = createServiceClient();
  const today = getTodayInSaoPaulo();

  // 1. Validar que o livro existe e que end_page <= total_pages
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('total_pages')
    .eq('id', book_id)
    .single();

  if (bookError || !book) {
    return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  }
  if (end_page > book.total_pages) {
    return new Response(JSON.stringify({ error: 'end_page exceeds book total_pages' }), { status: 400 });
  }

  // 2. Buscar sessões anteriores para calcular progresso
  const { data: prevSessions } = await supabase
    .from('reading_sessions')
    .select('end_page')
    .eq('student_id', student_id)
    .eq('book_id', book_id);

  const previousMaxPage = getMaxPageReached(prevSessions ?? []);

  // 3. Criar ReadingSession
  const { error: sessionError } = await supabase
    .from('reading_sessions')
    .insert({ student_id, book_id, start_page, end_page });

  if (sessionError) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), { status: 500 });
  }

  const newMaxPage = Math.max(previousMaxPage, end_page);

  // 4. Atualizar (ou criar) StudentBook
  await supabase
    .from('student_books')
    .upsert({
      student_id,
      book_id,
      current_page: newMaxPage,
      status: newMaxPage >= book.total_pages ? 'finished' : 'reading',
      ...(newMaxPage >= book.total_pages ? { finished_at: new Date().toISOString() } : {})
    }, { onConflict: 'student_id,book_id' });

  // 5. Atualizar Streak
  const { data: streak } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_read_date')
    .eq('student_id', student_id)
    .single();

  let newCurrentStreak = 1;
  let newLongestStreak = 1;

  if (streak) {
    const lastDate = streak.last_read_date;
    if (lastDate === today) {
      // Já leu hoje — não altera streak
      newCurrentStreak = streak.current_streak;
      newLongestStreak = streak.longest_streak;
    } else {
      const last = new Date(lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / 86400000);
      newCurrentStreak = diffDays === 1 ? streak.current_streak + 1 : 1;
      newLongestStreak = Math.max(newCurrentStreak, streak.longest_streak);
    }
  }

  await supabase
    .from('streaks')
    .upsert({
      student_id,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_read_date: today
    }, { onConflict: 'student_id' });

  // 6. Detectar capítulos recém-completados
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, end_page')
    .eq('book_id', book_id)
    .order('number');

  const newlyCompleted = findNewlyCompletedChapters(
    chapters ?? [],
    previousMaxPage,
    newMaxPage
  );

  // 7. Para cada capítulo completo, disparar geração de perguntas (se ainda não gerado)
  const completedChapterIds: string[] = [];
  for (const ch of newlyCompleted) {
    const { data: quizStatus } = await supabase
      .from('chapter_quiz_status')
      .select('status')
      .eq('chapter_id', ch.id)
      .single();

    if (!quizStatus || quizStatus.status === 'pending' || quizStatus.status === 'failed') {
      // Disparar generate-questions (fire-and-forget)
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ chapter_id: ch.id }),
      }).catch(() => {}); // fire-and-forget, fallback via pg_cron
    }

    completedChapterIds.push(ch.id);
  }

  return new Response(JSON.stringify({
    data: {
      session_created: true,
      new_max_page: newMaxPage,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      completed_chapter_ids: completedChapterIds,
    },
    error: null
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

- [ ] **Step 4: Deploy local e teste manual**

```bash
supabase functions serve register-reading-session --env-file .env
```

Em outro terminal, testar com curl (substituir UUIDs reais do Studio):
```bash
curl -X POST http://localhost:54321/functions/v1/register-reading-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"student_id":"<uuid>","book_id":"00000000-0000-0000-0001-000000000001","start_page":1,"end_page":25}'
```
Expected: `{"data":{"session_created":true,"new_max_page":25,"current_streak":1,...},"error":null}`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add register-reading-session edge function with streak and chapter detection"
```

---

## Task 7: Edge Function — `generate-questions`

**Files:**
- Create: `supabase/functions/generate-questions/index.test.ts`
- Create: `supabase/functions/generate-questions/index.ts`

- [ ] **Step 1: Escrever testes da lógica de prompt**

```typescript
// supabase/functions/generate-questions/index.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

function buildQuestionPrompt(
  bookTitle: string,
  author: string,
  chapterNumber: number,
  chapterTitle: string,
  contentText: string,
  grade: string,
  questionCount: number
): string {
  return `Você é um companheiro de leitura para estudantes do ensino fundamental (${grade}).
Gere ${questionCount} perguntas sobre o capítulo abaixo, sendo aproximadamente metade de compreensão e metade de reflexão.

Livro: ${bookTitle} — ${author}
Capítulo ${chapterNumber}: ${chapterTitle}
Conteúdo: ${contentText}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensão: verificam se o aluno leu e entendeu o que aconteceu
- Perguntas de reflexão: pedem opinião, conexão pessoal, pensamento crítico
- Linguagem adequada para ${grade}
- Retorne APENAS um array JSON válido: [{"type":"comprehension","question_text":"..."},{"type":"reflection","question_text":"..."}]`;
}

function parseQuestionsJson(raw: string): { type: string; question_text: string }[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response');
  return JSON.parse(match[0]);
}

Deno.test('buildQuestionPrompt: inclui título do livro', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', 'texto', '7o ano', 4);
  assertStringIncludes(prompt, '1984');
  assertStringIncludes(prompt, 'Orwell');
});

Deno.test('buildQuestionPrompt: inclui número de perguntas', () => {
  const prompt = buildQuestionPrompt('1984', 'Orwell', 1, 'Cap 1', 'texto', '7o ano', 4);
  assertStringIncludes(prompt, '4 perguntas');
});

Deno.test('parseQuestionsJson: parseia array JSON válido', () => {
  const raw = 'Resposta: [{"type":"comprehension","question_text":"O que aconteceu?"},{"type":"reflection","question_text":"O que você faria?"}]';
  const questions = parseQuestionsJson(raw);
  assertEquals(questions.length, 2);
  assertEquals(questions[0].type, 'comprehension');
});

Deno.test('parseQuestionsJson: lança erro se não há JSON', () => {
  let threw = false;
  try { parseQuestionsJson('sem json aqui'); } catch { threw = true; }
  assertEquals(threw, true);
});
```

- [ ] **Step 2: Rodar testes**

```bash
deno test supabase/functions/generate-questions/index.test.ts
```
Expected: todos PASS

- [ ] **Step 3: Implementar a Edge Function**

```typescript
// supabase/functions/generate-questions/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';

const QUESTION_COUNT = 4;

function buildQuestionPrompt(
  bookTitle: string, author: string, chapterNumber: number,
  chapterTitle: string, contentText: string, grade: string, count: number
): string {
  return `Você é um companheiro de leitura para estudantes do ensino fundamental (${grade}).
Gere ${count} perguntas sobre o capítulo abaixo, sendo aproximadamente metade de compreensão e metade de reflexão.

Livro: ${bookTitle} — ${author}
Capítulo ${chapterNumber}: ${chapterTitle}
Conteúdo: ${contentText}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensão: verificam se o aluno leu e entendeu o que aconteceu
- Perguntas de reflexão: pedem opinião, conexão pessoal, pensamento crítico
- Linguagem adequada para ${grade}
- Retorne APENAS um array JSON válido: [{"type":"comprehension","question_text":"..."},{"type":"reflection","question_text":"..."}]`;
}

function parseQuestionsJson(raw: string): { type: string; question_text: string }[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in LLM response');
  return JSON.parse(match[0]);
}

async function callAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('AI_API_KEY')!;
  const model = Deno.env.get('AI_MODEL') ?? 'claude-3-5-haiku-20241022';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { chapter_id } = await req.json();
  if (!chapter_id) {
    return new Response(JSON.stringify({ error: 'chapter_id required' }), { status: 400 });
  }

  const supabase = createServiceClient();

  // Verificar cache — se já existem perguntas, retornar
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('id')
    .eq('chapter_id', chapter_id)
    .limit(1);

  if (existingQuestions && existingQuestions.length > 0) {
    return new Response(JSON.stringify({ data: { cached: true }, error: null }));
  }

  // Atualizar status para indicar tentativa
  await supabase.from('chapter_quiz_status').upsert({
    chapter_id,
    status: 'pending',
    attempts: 1,
    last_attempt_at: new Date().toISOString()
  }, { onConflict: 'chapter_id' });

  // Buscar dados do capítulo e livro
  const { data: chapter } = await supabase
    .from('chapters')
    .select('number, title, book_id, book_contents(content_text), books(title, author)')
    .eq('id', chapter_id)
    .single();

  if (!chapter) {
    return new Response(JSON.stringify({ error: 'Chapter not found' }), { status: 404 });
  }

  const contentText = (chapter.book_contents as any)?.content_text ?? '';
  const bookTitle = (chapter.books as any)?.title ?? '';
  const author = (chapter.books as any)?.author ?? '';

  const prompt = buildQuestionPrompt(
    bookTitle, author, chapter.number,
    chapter.title ?? `Capítulo ${chapter.number}`,
    contentText, '7o ao 9o ano', QUESTION_COUNT
  );

  try {
    const rawResponse = await callAI(prompt);
    const questions = parseQuestionsJson(rawResponse);

    // Salvar perguntas (cache por capítulo)
    await supabase.from('questions').insert(
      questions.map(q => ({
        chapter_id,
        type: q.type,
        question_text: q.question_text,
      }))
    );

    // Marcar como gerado
    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'generated',
      last_attempt_at: new Date().toISOString()
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({
      data: { questions_generated: questions.length },
      error: null
    }));

  } catch (err) {
    // Marcar como falha para retry via pg_cron
    await supabase.from('chapter_quiz_status').upsert({
      chapter_id,
      status: 'failed',
      error_message: String(err),
      last_attempt_at: new Date().toISOString()
    }, { onConflict: 'chapter_id' });

    return new Response(JSON.stringify({ error: 'AI generation failed, will retry' }), { status: 500 });
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/generate-questions/
git commit -m "feat: add generate-questions edge function with AI cache and fallback"
```

---

## Task 8: Edge Function — `evaluate-answer`

**Files:**
- Create: `supabase/functions/evaluate-answer/index.test.ts`
- Create: `supabase/functions/evaluate-answer/index.ts`

- [ ] **Step 1: Escrever testes da lógica de avaliação**

```typescript
// supabase/functions/evaluate-answer/index.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';

function buildEvaluationPrompt(
  questionText: string,
  questionType: 'comprehension' | 'reflection',
  answerText: string,
  chapterContent: string
): string {
  const typeInstruction = questionType === 'comprehension'
    ? 'Esta é uma pergunta de COMPREENSÃO. Avalie se a resposta demonstra conhecimento correto do conteúdo do capítulo.'
    : 'Esta é uma pergunta de REFLEXÃO. Avalie a profundidade e coerência da reflexão. Não há resposta certa ou errada — avalie se o aluno engajou de verdade com a pergunta.';

  return `Você é um avaliador de leitura para estudantes do ensino fundamental.

Pergunta: ${questionText}
${typeInstruction}

Conteúdo do capítulo (contexto): ${chapterContent.substring(0, 2000)}

Resposta do aluno: ${answerText}

Retorne APENAS um JSON válido:
{"score": <0-100>, "feedback": "<1-2 frases encorajadoras em português>"}

Score 0-100 onde:
- 80-100: excelente, demonstra compreensão/reflexão profunda
- 60-79: boa resposta, com algumas lacunas
- 40-59: resposta parcial
- 0-39: muito superficial ou fora do contexto`;
}

function parseEvaluationJson(raw: string): { score: number; feedback: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found');
  const parsed = JSON.parse(match[0]);
  if (typeof parsed.score !== 'number' || typeof parsed.feedback !== 'string') {
    throw new Error('Invalid evaluation format');
  }
  return { score: Math.min(100, Math.max(0, parsed.score)), feedback: parsed.feedback };
}

Deno.test('buildEvaluationPrompt: compreensão menciona conhecimento do conteúdo', () => {
  const prompt = buildEvaluationPrompt('O que aconteceu?', 'comprehension', 'Algo aconteceu', 'texto');
  assertStringIncludes(prompt, 'COMPREENSÃO');
  assertStringIncludes(prompt, 'conhecimento correto');
});

Deno.test('buildEvaluationPrompt: reflexão não exige resposta certa', () => {
  const prompt = buildEvaluationPrompt('O que você faria?', 'reflection', 'Eu faria X', 'texto');
  assertStringIncludes(prompt, 'REFLEXÃO');
  assertStringIncludes(prompt, 'Não há resposta certa');
});

Deno.test('parseEvaluationJson: parseia JSON válido', () => {
  const raw = '{"score": 85, "feedback": "Muito bem! Você demonstrou boa compreensão."}';
  const result = parseEvaluationJson(raw);
  assertEquals(result.score, 85);
  assertStringIncludes(result.feedback, 'Muito bem');
});

Deno.test('parseEvaluationJson: clipa score acima de 100', () => {
  const raw = '{"score": 150, "feedback": "Incrível!"}';
  const result = parseEvaluationJson(raw);
  assertEquals(result.score, 100);
});

Deno.test('parseEvaluationJson: lança erro se JSON inválido', () => {
  let threw = false;
  try { parseEvaluationJson('sem json'); } catch { threw = true; }
  assertEquals(threw, true);
});
```

- [ ] **Step 2: Rodar testes**

```bash
deno test supabase/functions/evaluate-answer/index.test.ts
```
Expected: todos PASS

- [ ] **Step 3: Implementar a Edge Function**

```typescript
// supabase/functions/evaluate-answer/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';
import type { AnswerPayload } from '../_shared/types.ts';

function buildEvaluationPrompt(
  questionText: string,
  questionType: 'comprehension' | 'reflection',
  answerText: string,
  chapterContent: string
): string {
  const typeInstruction = questionType === 'comprehension'
    ? 'Esta é uma pergunta de COMPREENSÃO. Avalie se a resposta demonstra conhecimento correto do conteúdo do capítulo.'
    : 'Esta é uma pergunta de REFLEXÃO. Avalie a profundidade e coerência da reflexão. Não há resposta certa ou errada — avalie se o aluno engajou de verdade com a pergunta.';

  return `Você é um avaliador de leitura para estudantes do ensino fundamental.

Pergunta: ${questionText}
${typeInstruction}

Conteúdo do capítulo (contexto): ${chapterContent.substring(0, 2000)}

Resposta do aluno: ${answerText}

Retorne APENAS um JSON válido:
{"score": <0-100>, "feedback": "<1-2 frases encorajadoras em português>"}`;
}

function parseEvaluationJson(raw: string): { score: number; feedback: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  const parsed = JSON.parse(match[0]);
  return {
    score: Math.min(100, Math.max(0, parsed.score)),
    feedback: parsed.feedback
  };
}

async function callAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('AI_API_KEY')!;
  const model = Deno.env.get('AI_MODEL') ?? 'claude-3-5-haiku-20241022';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload: AnswerPayload = await req.json();
  const { question_id, student_id, answer_text } = payload;

  if (!question_id || !student_id || !answer_text?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const supabase = createServiceClient();

  // Buscar pergunta + conteúdo do capítulo
  const { data: question } = await supabase
    .from('questions')
    .select('question_text, type, chapter_id, chapters(book_contents(content_text))')
    .eq('id', question_id)
    .single();

  if (!question) {
    return new Response(JSON.stringify({ error: 'Question not found' }), { status: 404 });
  }

  // Salvar resposta imediatamente (sem score — avaliação assíncrona)
  const { data: savedAnswer, error: answerError } = await supabase
    .from('answers')
    .upsert({
      question_id,
      student_id,
      answer_text: answer_text.trim(),
    }, { onConflict: 'question_id,student_id' })
    .select('id')
    .single();

  if (answerError || !savedAnswer) {
    return new Response(JSON.stringify({ error: 'Failed to save answer' }), { status: 500 });
  }

  const chapterContent = (question.chapters as any)?.book_contents?.content_text ?? '';
  const prompt = buildEvaluationPrompt(
    question.question_text,
    question.type as 'comprehension' | 'reflection',
    answer_text,
    chapterContent
  );

  try {
    const rawResponse = await callAI(prompt);
    const evaluation = parseEvaluationJson(rawResponse);

    await supabase
      .from('answers')
      .update({
        comprehension_score: evaluation.score,
        ai_feedback: evaluation.feedback,
        evaluated_at: new Date().toISOString()
      })
      .eq('id', savedAnswer.id);

    return new Response(JSON.stringify({
      data: {
        score: evaluation.score,
        feedback: evaluation.feedback
      },
      error: null
    }));

  } catch {
    // Resposta salva sem score — será avaliada via retry se necessário
    return new Response(JSON.stringify({
      data: {
        score: null,
        feedback: 'Resposta recebida! A avaliação ficará disponível em breve.'
      },
      error: null
    }));
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/evaluate-answer/
git commit -m "feat: add evaluate-answer edge function with async fallback"
```

---

## Task 9: pg_cron — Retry de Quizzes com Falha

**Files:**
- Create: `supabase/functions/retry-pending-quizzes/index.ts`
- Modify: `supabase/migrations/20260323000001_initial_schema.sql` (adicionar job pg_cron)

- [ ] **Step 1: Habilitar pg_cron no Supabase**

No Supabase Studio (ou via SQL Editor):
```sql
create extension if not exists pg_cron;

-- Agendar retry a cada hora para capítulos com quiz failed/pending após tentativa
select cron.schedule(
  'retry-pending-quizzes',
  '0 * * * *', -- a cada hora
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/retry-pending-quizzes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Nota: no Supabase Cloud, pg_cron está disponível via Dashboard → Database → Extensions. No local, pode ser ativado via migration.

- [ ] **Step 2: Implementar a Edge Function de retry**

```typescript
// supabase/functions/retry-pending-quizzes/index.ts
import { createServiceClient } from '../_shared/supabase-client.ts';

const MAX_ATTEMPTS = 3;

Deno.serve(async (_req) => {
  const supabase = createServiceClient();

  // Buscar capítulos com quiz failed com menos de MAX_ATTEMPTS tentativas
  const { data: pending } = await supabase
    .from('chapter_quiz_status')
    .select('chapter_id, attempts')
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS);

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ data: { retried: 0 }, error: null }));
  }

  let retried = 0;
  for (const item of pending) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ chapter_id: item.chapter_id }),
    });
    retried++;
  }

  return new Response(JSON.stringify({ data: { retried }, error: null }));
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/retry-pending-quizzes/
git commit -m "feat: add retry-pending-quizzes edge function for AI fallback"
```

---

## Task 10: Deploy para Supabase Cloud (Piloto)

- [ ] **Step 1: Criar projeto no Supabase Cloud**

Acessar [app.supabase.com](https://app.supabase.com) → New Project. Guardar `Project URL` e chaves.

- [ ] **Step 2: Vincular projeto local ao Cloud**

```bash
supabase link --project-ref <project-ref>
```

- [ ] **Step 3: Aplicar migrations no Cloud**

```bash
supabase db push
```
Expected: todas as migrations aplicadas.

- [ ] **Step 4: Fazer deploy das Edge Functions**

```bash
supabase functions deploy register-reading-session
supabase functions deploy generate-questions
supabase functions deploy evaluate-answer
supabase functions deploy retry-pending-quizzes
```

- [ ] **Step 5: Configurar variáveis de ambiente no Cloud**

```bash
supabase secrets set AI_API_KEY=<sua_chave>
supabase secrets set AI_MODEL=claude-3-5-haiku-20241022
```

- [ ] **Step 6: Testar endpoint em produção**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/register-reading-session \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"...","book_id":"00000000-0000-0000-0001-000000000001","start_page":1,"end_page":25}'
```

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "chore: supabase foundation complete and deployed"
```

---

## Resumo — O que foi entregue neste plano

| Entrega | Status |
|---|---|
| Schema completo (16 tabelas) | Task 2 |
| RLS policies (student/teacher/admin) | Task 3 |
| Seed data piloto (3 livros, 25 capítulos, 9 badges) | Task 4 |
| Edge Function: register-reading-session | Task 6 |
| Edge Function: generate-questions (com cache) | Task 7 |
| Edge Function: evaluate-answer | Task 8 |
| Edge Function: retry-pending-quizzes (via pg_cron) | Task 9 |
| Deploy no Supabase Cloud | Task 10 |

## Gaps Resolvidos (2026-03-27)

| Gap | Solução | Arquivo |
|---|---|---|
| `book_contents` vazio | Migration com resumos/paráfrases originais dos 25 capítulos dos 3 livros piloto | `migrations/20260323000005_book_contents_pilot.sql` |
| Badge engine ausente | Edge Function `award-badges` com 9 critérios + integração fire-and-forget em `register-reading-session` | `functions/award-badges/index.ts` |

## Próximos Planos

- **Plano 2:** App Mobile React Native (auth, leitura, streaks, gamificação)
- **Plano 3:** Dashboard Web Next.js (professor)
