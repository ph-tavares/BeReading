import { create } from 'zustand';
import type { StudentBook, Book } from '../types/database';

export interface CurrentBook {
  studentBook: StudentBook;
  book: Book;
}

interface ReadingState {
  currentBook: CurrentBook | null;
  setCurrentBook: (current: CurrentBook | null) => void;
}

export const useReadingStore = create<ReadingState>((set) => ({
  currentBook: null,
  setCurrentBook: (currentBook) => set({ currentBook }),
}));
