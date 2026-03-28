import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Student, Classroom } from '../types/database';

interface AuthState {
  session: Session | null;
  student: Student | null;
  classroom: Classroom | null;
  setSession: (session: Session | null) => void;
  setStudent: (student: Student | null) => void;
  setClassroom: (classroom: Classroom | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  student: null,
  classroom: null,
  setSession: (session) => set({ session }),
  setStudent: (student) => set({ student }),
  setClassroom: (classroom) => set({ classroom }),
  clear: () => set({ session: null, student: null, classroom: null }),
}));
