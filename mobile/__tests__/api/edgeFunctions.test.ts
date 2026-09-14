// Mock supabase client para isolar funções puras do SDK
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import {
  buildRegisterReadingPayload,
  buildEvaluateAnswerPayload,
  evaluateAnswer,
  interpretEvaluateFailure,
  deleteAccount,
} from '../../src/api/edgeFunctions';
import { supabase } from '../../src/lib/supabase';

const invoke = supabase.functions.invoke as jest.Mock;

/** Erro do supabase-js para resposta não-2xx: o corpo vem em `context`. */
const httpError = (status: number, body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: { status, json: async () => body },
});

describe('interpretEvaluateFailure (BER-48)', () => {
  it('409: devolve a avaliação que já existe, marcada como repetida', () => {
    expect(interpretEvaluateFailure(409, {
      error: 'Answer already submitted',
      data: { score: 74, feedback: 'Boa leitura.' },
    })).toEqual({ score: 74, feedback: 'Boa leitura.', alreadyAnswered: true });
  });

  it('409 de resposta ainda sem nota não vira zero', () => {
    expect(interpretEvaluateFailure(409, {
      error: 'Answer already submitted',
      data: { score: null, feedback: 'Resposta recebida! A avaliação ficará disponível em breve.' },
    })).toEqual({
      score: null,
      feedback: 'Resposta recebida! A avaliação ficará disponível em breve.',
      alreadyAnswered: true,
    });
  });

  it('403 de capítulo não lido vira uma mensagem que o leitor entende', () => {
    expect(() => interpretEvaluateFailure(403, { error: 'Chapter not completed' }))
      .toThrow('Termine de ler este capítulo para responder o quiz.');
  });

  it('outros erros não são interpretados (quem chamou relança o original)', () => {
    expect(interpretEvaluateFailure(403, { error: 'Forbidden' })).toBeNull();
    expect(interpretEvaluateFailure(500, { error: 'Failed to save answer' })).toBeNull();
    expect(interpretEvaluateFailure(undefined, null)).toBeNull();
  });
});

describe('evaluateAnswer', () => {
  beforeEach(() => invoke.mockReset());

  it('responder de novo não quebra: devolve a avaliação anterior (409)', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(409, { error: 'Answer already submitted', data: { score: 88, feedback: 'Ótimo.' } }),
    });
    await expect(evaluateAnswer('q-1', 'user-1', 'de novo'))
      .resolves.toEqual({ score: 88, feedback: 'Ótimo.', alreadyAnswered: true });
  });

  it('resposta nova segue devolvendo nota e feedback', async () => {
    invoke.mockResolvedValue({ data: { data: { score: 70, feedback: 'Bom.' }, error: null }, error: null });
    await expect(evaluateAnswer('q-1', 'user-1', 'resposta'))
      .resolves.toEqual({ score: 70, feedback: 'Bom.' });
  });

  it('erro que não é 409/403 continua sendo lançado', async () => {
    const err = httpError(500, { error: 'Failed to save answer' });
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(evaluateAnswer('q-1', 'user-1', 'resposta')).rejects.toBe(err);
  });
});

describe('buildRegisterReadingPayload', () => {
  it('monta payload com user_id', () => {
    const result = buildRegisterReadingPayload('user-1', 'book-1', 5, 25);
    expect(result).toEqual({
      user_id: 'user-1',
      book_id: 'book-1',
      start_page: 5,
      end_page: 25,
    });
  });
});

describe('buildEvaluateAnswerPayload', () => {
  it('monta payload com user_id e answer trimada', () => {
    const result = buildEvaluateAnswerPayload('q-1', 'user-1', '  minha resposta  ');
    expect(result).toEqual({
      question_id: 'q-1',
      user_id: 'user-1',
      answer_text: 'minha resposta',
    });
  });

  it('retorna null para answer vazia após trim', () => {
    const result = buildEvaluateAnswerPayload('q-1', 'user-1', '   ');
    expect(result).toBeNull();
  });
});

describe('deleteAccount (BER-62)', () => {
  beforeEach(() => invoke.mockReset());

  it('chama a function sem body — o dono é sempre quem está logado', async () => {
    invoke.mockResolvedValue({ data: { data: { deleted: true }, error: null }, error: null });
    await deleteAccount();
    expect(invoke).toHaveBeenCalledWith('delete-account');
  });

  it('erro de rede/HTTP é relançado', async () => {
    const err = new Error('network error');
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(deleteAccount()).rejects.toBe(err);
  });

  it('erro de negócio no corpo vira Error', async () => {
    invoke.mockResolvedValue({ data: { data: null, error: 'Failed to delete account data' }, error: null });
    await expect(deleteAccount()).rejects.toThrow('Failed to delete account data');
  });
});
