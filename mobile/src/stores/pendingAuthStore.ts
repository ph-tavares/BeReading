import { create } from 'zustand';

interface PendingAuthState {
  pendingPassword: string | null;
  setPendingPassword: (password: string) => void;
  clearPendingPassword: () => void;
}

export const usePendingAuthStore = create<PendingAuthState>((set) => ({
  pendingPassword: null,
  setPendingPassword: (password) => set({ pendingPassword: password }),
  clearPendingPassword: () => set({ pendingPassword: null }),
}));
