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

// Stub para satisfazer o genérico do createClient
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'user_id' | 'created_at'>>;
      };
      classrooms: { Row: Classroom; Insert: Omit<Classroom, 'id' | 'created_at'> };
      schools: { Row: School; Insert: Omit<School, 'id' | 'created_at'> };
      books: { Row: Book; Insert: Omit<Book, 'id' | 'created_at'> };
      chapters: { Row: Chapter; Insert: Omit<Chapter, 'id'> };
      student_books: {
        Row: StudentBook;
        Insert: Omit<StudentBook, 'id' | 'started_at' | 'finished_at'> & {
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<Omit<StudentBook, 'id'>>;
      };
      reading_sessions: {
        Row: ReadingSession;
        Insert: Omit<ReadingSession, 'id' | 'read_at'> & { read_at?: string };
      };
      questions: { Row: Question; Insert: Omit<Question, 'id' | 'generated_at'> };
      answers: {
        Row: Answer;
        Insert: Omit<Answer, 'id' | 'answered_at' | 'evaluated_at'>;
      };
      streaks: { Row: Streak; Insert: Omit<Streak, 'id'> };
      badges: { Row: Badge; Insert: Omit<Badge, 'id'> };
      student_badges: {
        Row: StudentBadge;
        Insert: Omit<StudentBadge, 'id' | 'earned_at'>;
      };
      classroom_books: { Row: ClassroomBook; Insert: Omit<ClassroomBook, 'id'> };
      chapter_quiz_status: {
        Row: ChapterQuizStatus;
        Insert: Omit<ChapterQuizStatus, 'id'>;
      };
    };
  };
}
