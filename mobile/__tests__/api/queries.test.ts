jest.mock('../../src/lib/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { supabase: { from: jest.fn(() => chain), __chain: chain } };
});

import { supabase } from '../../src/lib/supabase';
import {
  getProfileByUserId,
  createProfile,
  joinClassroom,
  getClassroomByCode,
} from '../../src/api/queries';
import type { Profile, Classroom } from '../../src/types/database';

const chain = (supabase as any).__chain;

const mockProfile: Profile = {
  user_id: 'u1',
  classroom_id: null,
  display_name: 'Ana',
  created_at: '2026-01-01',
};

const mockClassroom: Classroom = {
  id: 'c1',
  school_id: 'sc1',
  name: '8A',
  grade: '8',
  year: 2026,
  class_code: 'ABCD1234',
  created_at: '2026-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
});

describe('getProfileByUserId', () => {
  it('retorna profile quando encontrado', async () => {
    chain.single.mockResolvedValue({ data: mockProfile, error: null });
    const result = await getProfileByUserId('u1');
    expect(result).toEqual(mockProfile);
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('retorna null quando não encontrado (PGRST116)', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    const result = await getProfileByUserId('u1');
    expect(result).toBeNull();
  });

  it('lança erro para outros erros', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: '42P01', message: 'db error' } });
    await expect(getProfileByUserId('u1')).rejects.toMatchObject({ code: '42P01' });
  });
});

describe('createProfile', () => {
  it('cria profile e retorna o dado', async () => {
    chain.single.mockResolvedValue({ data: mockProfile, error: null });
    const result = await createProfile('u1', 'Ana');
    expect(result).toEqual(mockProfile);
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(chain.insert).toHaveBeenCalledWith({ user_id: 'u1', display_name: 'Ana' });
  });

  it('lança erro se insert falhar', async () => {
    chain.single.mockResolvedValue({ data: null, error: { message: 'constraint violation' } });
    await expect(createProfile('u1', 'Ana')).rejects.toBeTruthy();
  });
});

describe('joinClassroom', () => {
  it('atualiza classroom_id do profile e retorna', async () => {
    chain.single
      .mockResolvedValueOnce({ data: mockClassroom, error: null })
      .mockResolvedValueOnce({ data: { ...mockProfile, classroom_id: 'c1' }, error: null });
    const result = await joinClassroom('u1', 'ABCD1234');
    expect(result.classroom_id).toBe('c1');
    expect(chain.update).toHaveBeenCalledWith({ classroom_id: 'c1' });
  });

  it('lança erro se classroom não encontrada', async () => {
    chain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(joinClassroom('u1', 'INVALIDO1')).rejects.toThrow('Turma não encontrada');
  });
});
