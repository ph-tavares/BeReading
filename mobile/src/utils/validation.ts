export function validatePageRange(
  startPage: number,
  endPage: number,
  totalPages: number
): string | null {
  if (startPage < 1) return 'Página inicial deve ser maior que zero';
  if (endPage < startPage) return 'Página final deve ser maior ou igual à inicial';
  if (endPage > totalPages) return 'Página final excede o total de páginas do livro';
  return null;
}

export function validateClassroomCode(code: string): string | null {
  if (!code.trim()) return 'Informe o código da turma';
  if (code.trim().length !== 8) return 'Código deve ter 8 caracteres';
  return null;
}
