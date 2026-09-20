// Mock supabase client para isolar funções puras do SDK
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import {
  buildRegisterReadingPayload,
  buildEvaluateAnswerPayload,
  evaluateAnswer,
  interpretEvaluateFailure,
  interpretScanFailure,
  scanPage,
  deleteAccount,
  registerReadingSession,
  startReadingBook,
  stopReadingBook,
} from '../../src/api/edgeFunctions';
import { supabase } from '../../src/lib/supabase';
import { isQuotaExceededError } from '../../src/utils/billing';

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

const QUOTA_BODY = {
  error: 'quota_exceeded',
  data: { reason: 'active_books', limit: 2, used: 2, resets_at: null },
};

describe('limites do plano (BER-58)', () => {
  beforeEach(() => invoke.mockReset());

  it('402 no evaluate-answer vira QuotaExceededError com os dados do limite', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(402, {
        error: 'quota_exceeded',
        data: { reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z' },
      }),
    });

    const err = await evaluateAnswer('q-1', 'user-1', 'resposta').catch((e) => e);
    expect(isQuotaExceededError(err)).toBe(true);
    expect(err.quota).toEqual({ reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z' });
  });

  it('interpretEvaluateFailure lança no 402 de cota', () => {
    expect(() => interpretEvaluateFailure(402, QUOTA_BODY)).toThrow('Você já está lendo 2 livros');
  });

  it('startReadingBook chama reading-list com action start', async () => {
    invoke.mockResolvedValue({
      data: { data: { book_id: 'book-1', status: 'reading', current_page: 1 }, error: null },
      error: null,
    });
    await expect(startReadingBook('book-1')).resolves.toEqual({ book_id: 'book-1', status: 'reading', current_page: 1 });
    expect(invoke).toHaveBeenCalledWith('reading-list', { body: { action: 'start', book_id: 'book-1' } });
  });

  it('startReadingBook no limite de livros lança QuotaExceededError', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(402, QUOTA_BODY) });
    const err = await startReadingBook('book-3').catch((e) => e);
    expect(isQuotaExceededError(err)).toBe(true);
  });

  it('stopReadingBook chama reading-list com action stop', async () => {
    invoke.mockResolvedValue({
      data: { data: { book_id: 'book-1', status: 'dropped', current_page: 42 }, error: null },
      error: null,
    });
    await expect(stopReadingBook('book-1')).resolves.toEqual({ book_id: 'book-1', status: 'dropped', current_page: 42 });
    expect(invoke).toHaveBeenCalledWith('reading-list', { body: { action: 'stop', book_id: 'book-1' } });
  });

  it('registerReadingSession: 402 vira QuotaExceededError; outros erros seguem como vieram', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(402, QUOTA_BODY) });
    expect(isQuotaExceededError(await registerReadingSession('u', 'b', 1, 10).catch((e) => e))).toBe(true);

    const other = httpError(500, { error: 'Failed to create session' });
    invoke.mockResolvedValue({ data: null, error: other });
    await expect(registerReadingSession('u', 'b', 1, 10)).rejects.toBe(other);
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

describe('scanPage (BER-100)', () => {
  beforeEach(() => invoke.mockReset());

  const RESULTADO = {
    conversation_id: 'conv-1',
    page_text: 'Quem controla o passado controla o futuro.',
    suggestions: ['o que é duplipensar', 'me explica esse trecho'],
    detected_page: 220,
    chapter_number: 9,
    registered_page: 200,
    book: { id: 'book-1', title: '1984', author: 'George Orwell' },
    book_title_text: null,
  };

  it('manda a foto e o livro, e devolve transcrição e sugestões', async () => {
    invoke.mockResolvedValue({ data: { data: RESULTADO, error: null }, error: null });

    const result = await scanPage({
      imageBase64: 'QUJD',
      imageMediaType: 'image/jpeg',
      bookId: 'book-1',
    });

    expect(result).toEqual(RESULTADO);
    expect(invoke).toHaveBeenCalledWith('scan-page', {
      body: { image_base64: 'QUJD', image_media_type: 'image/jpeg', book_id: 'book-1' },
    });
  });

  it('sem livro na estante, o corpo vai sem book_id (D20)', async () => {
    invoke.mockResolvedValue({ data: { data: RESULTADO, error: null }, error: null });
    await scanPage({ imageBase64: 'QUJD', imageMediaType: 'image/jpeg' });
    expect(invoke.mock.calls[0][1].body).toEqual({ image_base64: 'QUJD', image_media_type: 'image/jpeg' });
  });

  it('cada recusa do servidor vira o código que a tela conhece', async () => {
    const casos: [number, string, string][] = [
      [422, 'not_a_book_page', 'not_a_book_page'],
      [413, 'image_too_large', 'image_too_large'],
      [503, 'ai_image_unsupported', 'ai_image_unsupported'],
      [503, 'ai_unavailable', 'ai_unavailable'],
      [500, 'scan_failed', 'scan_failed'],
    ];
    for (const [status, erro, esperado] of casos) {
      invoke.mockResolvedValue({ data: null, error: httpError(status, { error: erro }) });
      await expect(scanPage({ imageBase64: 'QUJD', imageMediaType: 'image/jpeg' }))
        .rejects.toMatchObject({ code: esperado });
    }
  });

  it('erro sem resposta do servidor é falta de internet, não falha nossa', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Network request failed') });
    await expect(scanPage({ imageBase64: 'QUJD', imageMediaType: 'image/jpeg' }))
      .rejects.toMatchObject({ code: 'offline' });
  });

  it('corpo desconhecido não vira "falha nossa" por conta própria', () => {
    expect(interpretScanFailure(400, { error: 'algo que o app não conhece' })).toBe('unknown');
    expect(interpretScanFailure(undefined, null)).toBe('unknown');
    // Sem corpo reconhecível, o status ainda diz o suficiente.
    expect(interpretScanFailure(422, null)).toBe('not_a_book_page');
  });
});
