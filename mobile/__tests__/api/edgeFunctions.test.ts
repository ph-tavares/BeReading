// Mock supabase client para isolar funções puras do SDK
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { buildRegisterReadingPayload, buildEvaluateAnswerPayload } from '../../src/api/edgeFunctions';

describe('buildRegisterReadingPayload', () => {
  it('monta payload correto', () => {
    const result = buildRegisterReadingPayload('student-1', 'book-1', 5, 25);
    expect(result).toEqual({
      student_id: 'student-1',
      book_id: 'book-1',
      start_page: 5,
      end_page: 25,
    });
  });
});

describe('buildEvaluateAnswerPayload', () => {
  it('monta payload com answer trimado', () => {
    const result = buildEvaluateAnswerPayload('q-1', 'student-1', '  minha resposta  ');
    expect(result).toEqual({
      question_id: 'q-1',
      student_id: 'student-1',
      answer_text: 'minha resposta',
    });
  });

  it('retorna null para answer vazia após trim', () => {
    const result = buildEvaluateAnswerPayload('q-1', 'student-1', '   ');
    expect(result).toBeNull();
  });
});
