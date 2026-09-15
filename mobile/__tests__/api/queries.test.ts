jest.mock('../../src/lib/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
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
  getMyAnswers,
  getBooks,
} from '../../src/api/queries';
import type { MyAnswer } from '../../src/api/queries';
import type { Profile, Classroom, Book } from '../../src/types/database';

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
  chain.order.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.data = undefined;
  chain.error = null;
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

describe('getMyAnswers', () => {
  // Tipado como MyAnswer de proposito: fixture solta compila com campo
  // faltando ou com nome errado, e o teste passa validando um formato que a
  // consulta real nunca devolveria.
  const mockAnswers: MyAnswer[] = [
    {
      id: 'a1',
      question_id: 'q1',
      user_id: 'u1',
      answer_text: 'resposta',
      comprehension_score: 90,
      ai_feedback: null,
      answered_at: '2026-01-01',
      evaluation_status: 'completed',
      evaluated_at: '2026-01-01',
      question: { chapter_id: 'ch1' },
    },
  ];

  it('busca as respostas do próprio usuário, com o join que dá o chapter_id', async () => {
    chain.data = mockAnswers;
    chain.error = null;
    const result = await getMyAnswers('u1');
    expect(result).toEqual(mockAnswers);
    expect(supabase.from).toHaveBeenCalledWith('answers');
    expect(chain.select).toHaveBeenCalledWith('*, question:questions!inner(chapter_id)');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('sem resposta nenhuma, devolve lista vazia', async () => {
    chain.data = null;
    chain.error = null;
    const result = await getMyAnswers('u1');
    expect(result).toEqual([]);
  });

  it('lança erro quando a consulta falha', async () => {
    chain.data = null;
    chain.error = { message: 'db error' };
    await expect(getMyAnswers('u1')).rejects.toBeTruthy();
  });
});

describe('getBooks', () => {
  const mockBooks: Book[] = [
    { id: 'b1', title: 'Dom Casmurro', author: 'Machado de Assis', cover_url: null, total_pages: 200, genre: 'Romance', created_at: '2026-01-01' },
  ];

  it('sem termo de busca, não filtra por or()', async () => {
    chain.data = mockBooks;
    chain.error = null;
    const result = await getBooks();
    expect(result).toEqual(mockBooks);
    expect(chain.or).not.toHaveBeenCalled();
  });

  it('filtra por título ou autor', async () => {
    chain.data = mockBooks;
    chain.error = null;
    await getBooks('Machado');
    expect(chain.or).toHaveBeenCalledWith('title.ilike."%Machado%",author.ilike."%Machado%"');
  });

  // BER: o .or() do PostgREST recebe uma string só, que ele mesmo despedaça por
  // vírgula e parênteses. Um termo como "Machado, Assis (1908)" não pode virar
  // uma terceira condição nem reabrir o agrupamento. A prova aqui não é só
  // comparar a string exata — é reimplementar (no teste, não no código) o
  // corte por vírgula fora de aspas que o PostgREST faz, e confirmar que ainda
  // sobra exatamente 2 condições, cada uma com o termo original intacto.
  it('termo com vírgula e parênteses não parte o filtro or()', async () => {
    chain.data = [];
    chain.error = null;
    const termoPerigoso = 'Machado, Assis (1908)';
    await getBooks(termoPerigoso);

    const [filtro] = chain.or.mock.calls[0];
    const condicoes = splitForaDeAspas(filtro);

    expect(condicoes).toHaveLength(2);
    expect(condicoes[0]).toMatch(/^title\.ilike\./);
    expect(condicoes[1]).toMatch(/^author\.ilike\./);
    expect(valorEntreAspas(condicoes[0])).toBe(`%${termoPerigoso}%`);
    expect(valorEntreAspas(condicoes[1])).toBe(`%${termoPerigoso}%`);
  });

  it('lança erro quando a consulta falha', async () => {
    chain.data = null;
    chain.error = { message: 'db error' };
    await expect(getBooks()).rejects.toBeTruthy();
  });
});

/** Corta por vírgula, mas ignora vírgula dentro de aspas duplas — o mesmo critério do parser de `.or()` do PostgREST. */
function splitForaDeAspas(s: string): string[] {
  const partes: string[] = [];
  let atual = '';
  let dentroDeAspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== '\\') dentroDeAspas = !dentroDeAspas;
    if (c === ',' && !dentroDeAspas) {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  partes.push(atual);
  return partes;
}

/** Extrai e desescapa o valor entre aspas duplas de uma condição `coluna.op."valor"`. */
function valorEntreAspas(condicao: string): string {
  const match = condicao.match(/"(.*)"$/s);
  if (!match) throw new Error(`condição sem valor entre aspas: ${condicao}`);
  return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
