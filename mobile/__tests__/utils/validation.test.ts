import { validatePageRange, validateClassroomCode } from '../../src/utils/validation';

describe('validatePageRange', () => {
  it('retorna erro se start_page < 1', () => {
    expect(validatePageRange(0, 10, 100)).toBe('Página inicial deve ser maior que zero');
  });

  it('retorna erro se end_page < start_page', () => {
    expect(validatePageRange(20, 10, 100)).toBe('Página final deve ser maior ou igual à inicial');
  });

  it('retorna erro se end_page > total_pages', () => {
    expect(validatePageRange(1, 101, 100)).toBe('Página final excede o total de páginas do livro');
  });

  it('retorna null para range válido', () => {
    expect(validatePageRange(1, 50, 100)).toBeNull();
    expect(validatePageRange(50, 50, 100)).toBeNull();
  });
});

describe('validateClassroomCode', () => {
  it('retorna erro para código vazio', () => {
    expect(validateClassroomCode('')).toBe('Informe o código da turma');
  });

  it('retorna erro para código muito curto', () => {
    expect(validateClassroomCode('abc')).toBe('Código deve ter 8 caracteres');
  });

  it('retorna null para código com 8 caracteres', () => {
    expect(validateClassroomCode('abcd1234')).toBeNull();
  });
});
