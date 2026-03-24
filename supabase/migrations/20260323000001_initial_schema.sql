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
  school_id uuid not null references public.schools(id) on delete cascade,
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
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- Books
create table public.books (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text not null,
  cover_url text,
  total_pages int not null check (total_pages > 0),
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
  constraint valid_pages check (end_page >= start_page and start_page >= 1)
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
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending', 'completed', 'failed')),
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
  criteria_type text not null check (criteria_type in ('streak_days', 'total_pages', 'books_finished', 'quiz_score', 'personal_book', 'quizzes_answered', 'reflection_score_80', 'avg_score_90_book', 'total_sessions')),
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
  assigned_by uuid references public.teachers(id) on delete set null,
  status text not null default 'required' check (status in ('required', 'recommended')),
  created_at timestamptz default now(),
  unique(classroom_id, book_id)
);

-- Indexes on high-frequency FK columns (PostgreSQL does not auto-index FKs)
create index on public.reading_sessions(student_id);
create index on public.reading_sessions(book_id);
create index on public.reading_sessions(student_id, book_id);
create index on public.answers(student_id);
create index on public.questions(chapter_id);
create index on public.students(classroom_id);
create index on public.student_books(student_id);
create index on public.chapter_quiz_status(status) where status = 'failed';
create index on public.classroom_books(classroom_id);
create index on public.classroom_teachers(teacher_id);
create index on public.classroom_teachers(classroom_id);
create index on public.student_badges(student_id);
