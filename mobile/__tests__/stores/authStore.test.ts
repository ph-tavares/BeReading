import { useAuthStore } from '../../src/stores/authStore';
import type { Session } from '@supabase/supabase-js';
import type { Student, Classroom } from '../../src/types/database';

const mockSession = { access_token: 'tok', user: { id: 'u1' } } as unknown as Session;
const mockStudent: Student = {
  id: 's1', user_id: 'u1', classroom_id: 'c1', display_name: 'Ana', created_at: '2026-01-01',
};
const mockClassroom: Classroom = {
  id: 'c1', school_id: 'sc1', name: '8A', grade: '8', year: 2026,
  class_code: 'ABCD1234', created_at: '2026-01-01',
};

beforeEach(() => {
  useAuthStore.setState({ session: null, student: null, classroom: null });
});

describe('useAuthStore', () => {
  it('estado inicial é null', () => {
    const { session, student, classroom } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(student).toBeNull();
    expect(classroom).toBeNull();
  });

  it('setSession atualiza session', () => {
    useAuthStore.getState().setSession(mockSession);
    expect(useAuthStore.getState().session).toBe(mockSession);
  });

  it('setStudent atualiza student', () => {
    useAuthStore.getState().setStudent(mockStudent);
    expect(useAuthStore.getState().student).toEqual(mockStudent);
  });

  it('setClassroom atualiza classroom', () => {
    useAuthStore.getState().setClassroom(mockClassroom);
    expect(useAuthStore.getState().classroom).toEqual(mockClassroom);
  });

  it('clear reseta tudo para null', () => {
    useAuthStore.setState({ session: mockSession, student: mockStudent, classroom: mockClassroom });
    useAuthStore.getState().clear();
    const { session, student, classroom } = useAuthStore.getState();
    expect(session).toBeNull();
    expect(student).toBeNull();
    expect(classroom).toBeNull();
  });
});
