import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Student, Classroom } from '../types/database';

interface AuthState {
  session: Session | null;
  student: Student | null;
  classroom: Classroom | null;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  setStudent: (student: Student | null) => void;
  setClassroom: (classroom: Classroom | null) => void;
  setInitialized: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  student: null,
  classroom: null,
  isInitialized: false,
  setSession: (session) => set({ session }),
  setStudent: (student) => set({ student }),
  setClassroom: (classroom) => set({ classroom }),
  setInitialized: () => set({ isInitialized: true }),
  clear: () => set({ session: null, student: null, classroom: null }),
}));
