export interface Profile {
  user_id: string;
  classroom_id: string | null;
  display_name: string;
  created_at: string;
}

export interface Classroom {
  id: string;
  school_id: string;
  name: string;
  grade: string;
  year: number;
  class_code: string;
  created_at: string;
}

export interface School {
  id: string;
  name: string;
  city: string;
  state: string;
  invite_code: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  total_pages: number;
  genre: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  number: number;
  title: string | null;
  start_page: number;
  end_page: number;
}

export interface StudentBook {
  id: string;
  user_id: string;
  book_id: string;
  status: 'reading' | 'finished' | 'dropped';
  current_page: number;
  started_at: string;
  finished_at: string | null;
}

export interface ReadingSession {
  id: string;
  user_id: string;
  book_id: string;
  start_page: number;
  end_page: number;
  pages_read: number;
  read_at: string;
}

export interface Question {
  id: string;
  chapter_id: string;
  type: 'comprehension' | 'reflection';
  question_text: string;
  generated_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  user_id: string;
  answer_text: string;
  comprehension_score: number | null;
  ai_feedback: string | null;
  answered_at: string;
  evaluation_status: 'pending' | 'completed' | 'failed';
  evaluated_at: string | null;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_read_date: string | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  criteria_type: string;
  criteria_value: number;
}

export interface StudentBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface ClassroomBook {
  id: string;
  classroom_id: string;
  book_id: string;
  status: 'required' | 'recommended';
}

export interface ChapterQuizStatus {
  id: string;
  chapter_id: string;
  status: 'pending' | 'generated' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
}

// Schema tipado para o genérico do createClient.
//
// BER-34: o supabase-js só aceita este tipo se ele satisfizer `GenericSchema`
// (postgrest-js). O contrato é estrito: o schema precisa de `Tables`, `Views` e
// `Functions`, e CADA tabela precisa de `Row`, `Insert`, `Update` **e
// `Relationships`**. Faltando qualquer peça, o genérico degrada em silêncio e todo
// `.insert()`/`.update()` passa a ser tipado como `never` — a origem dos erros em
// `src/api/queries.ts`. O sintoma engana: parece que a tabela não existe.
//
// `Relationships: []` declara "sem joins tipados" — os selects com relação continuam
// funcionando, só não ganham inferência automática. Preencher isso exige o gerador
// (`supabase gen types`) contra o banco, que hoje não é reprodutível (BER-31).

// A armadilha final, e a menos óbvia: `GenericTable.Row` é `Record<string, unknown>`,
// e uma `interface` do TypeScript NÃO é atribuível a `Record<string, unknown>` —
// interfaces ficam abertas a declaration merging, então o compilador não pode garantir
// o índice. Um `type` é. Como as entidades aqui são declaradas com `interface`, o
// schema inteiro reprovava no `extends GenericSchema` e virava `never`.
// `Flatten` reprojeta a interface como type literal e fecha o buraco — é também o
// motivo de `supabase gen types` "resolver": o gerador emite `type`, não `interface`.
type Flatten<T> = { [K in keyof T]: T[K] };

/** Colunas que aceitam NULL — no Postgres, podem ser omitidas no insert. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Uma tabela do schema. Opcionais no `Insert`: o que o banco gera (`Generated`) e
 * o que aceita NULL — só assim o tipo descreve o insert que o Postgres realmente
 * aceita, em vez de exigir a linha inteira.
 */
type TableOf<Row, Generated extends keyof Row = never> = {
  Row: Flatten<Row>;
  Insert: Flatten<
    Omit<Row, Generated | NullableKeys<Row>> &
      Partial<Pick<Row, Generated | NullableKeys<Row>>>
  >;
  Update: Flatten<Partial<Row>>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableOf<Profile, 'created_at'>;
      classrooms: TableOf<Classroom, 'id' | 'created_at'>;
      schools: TableOf<School, 'id' | 'created_at'>;
      books: TableOf<Book, 'id' | 'created_at'>;
      chapters: TableOf<Chapter, 'id'>;
      student_books: TableOf<StudentBook, 'id' | 'started_at' | 'finished_at'>;
      reading_sessions: TableOf<ReadingSession, 'id' | 'read_at'>;
      questions: TableOf<Question, 'id' | 'generated_at'>;
      answers: TableOf<Answer, 'id' | 'answered_at' | 'evaluated_at'>;
      streaks: TableOf<Streak, 'id'>;
      badges: TableOf<Badge, 'id'>;
      student_badges: TableOf<StudentBadge, 'id' | 'earned_at'>;
      classroom_books: TableOf<ClassroomBook, 'id'>;
      chapter_quiz_status: TableOf<ChapterQuizStatus, 'id'>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
