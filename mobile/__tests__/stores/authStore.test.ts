import { useAuthStore } from '../../src/stores/authStore';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../../src/types/database';

const mockSession = {
  access_token: 'tok',
  user: { id: 'u1', email_confirmed_at: '2026-04-03T00:00:00Z' },
} as unknown as Session;

const mockProfile: Profile = {
  user_id: 'u1',
  classroom_id: null,
  display_name: 'Ana',
  created_at: '2026-01-01',
};

const mockProfileWithClassroom: Profile = {
  ...mockProfile,
  classroom_id: 'c1',
};

beforeEach(() => {
  useAuthStore.setState({ session: null, profile: null, isInitialized: false });
});

describe('useAuthStore', () => {
  it('estado inicial é null', () => {
    const { session, profile } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(profile).toBeNull();
  });

  it('setSession atualiza session', () => {
    useAuthStore.getState().setSession(mockSession);
    expect(useAuthStore.getState().session).toBe(mockSession);
  });

  it('setProfile atualiza profile', () => {
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profile).toEqual(mockProfile);
  });

  it('profile sem classroom_id indica usuário livre', () => {
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profile?.classroom_id).toBeNull();
  });

  it('profile com classroom_id indica usuário em turma', () => {
    useAuthStore.getState().setProfile(mockProfileWithClassroom);
    expect(useAuthStore.getState().profile?.classroom_id).toBe('c1');
  });

  it('clear reseta session e profile para null', () => {
    useAuthStore.setState({ session: mockSession, profile: mockProfile });
    useAuthStore.getState().clear();
    const { session, profile } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(profile).toBeNull();
  });

  it('isInitialized começa false', () => {
    expect(useAuthStore.getState().isInitialized).toBe(false);
  });

  it('setInitialized muda isInitialized para true', () => {
    useAuthStore.getState().setInitialized();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });
});

// BER-45: o perfil que não carrega precisa ser um estado visível, não silêncio.
// Antes, a falha morria num console.error e as abas giravam para sempre.
describe('profileStatus', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, profile: null, profileStatus: 'loading', isInitialized: false });
  });

  it('começa em loading', () => {
    expect(useAuthStore.getState().profileStatus).toBe('loading');
  });

  it('perfil que chega marca ready', () => {
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profileStatus).toBe('ready');
  });

  it('setProfileStatus("error") é o que a tela usa para oferecer o retry', () => {
    useAuthStore.getState().setProfileStatus('error');
    expect(useAuthStore.getState().profileStatus).toBe('error');
  });

  it('um retry bem-sucedido tira do erro', () => {
    useAuthStore.getState().setProfileStatus('error');
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profileStatus).toBe('ready');
    expect(useAuthStore.getState().profile).toEqual(mockProfile);
  });

  it('clear volta para loading — logout não pode deixar erro grudado', () => {
    useAuthStore.getState().setSession(mockSession);
    useAuthStore.getState().setProfileStatus('error');
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.profileStatus).toBe('loading');
    expect(s.profile).toBeNull();
    expect(s.session).toBeNull();
  });
});
