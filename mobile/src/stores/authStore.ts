import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types/database';

/**
 * Estado do carregamento do perfil (BER-45).
 *
 * Sem isto, uma falha de rede no cold start deixava `profile` null sem nenhum
 * sinal — e as telas, que esperavam por ele, giravam o spinner para sempre.
 */
export type ProfileStatus = 'loading' | 'ready' | 'error';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setProfileStatus: (status: ProfileStatus) => void;
  setInitialized: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  profileStatus: 'loading',
  isInitialized: false,
  setSession: (session) => set({ session }),
  // Perfil que chega é perfil pronto; null volta para 'loading' (ex.: logout).
  setProfile: (profile) => set({ profile, profileStatus: profile ? 'ready' : 'loading' }),
  setProfileStatus: (profileStatus) => set({ profileStatus }),
  setInitialized: () => set({ isInitialized: true }),
  clear: () => set({ session: null, profile: null, profileStatus: 'loading' }),
}));
