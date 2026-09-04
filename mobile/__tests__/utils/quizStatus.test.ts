import { isNoContentStatus, quizScreenStateFor } from '../../src/utils/quizStatus';
import type { ChapterQuizStatus } from '../../src/types/database';

function status(over: Partial<ChapterQuizStatus> = {}): ChapterQuizStatus {
  return {
    id: 'qs-1',
    chapter_id: 'ch-1',
    status: 'failed',
    attempts: 1,
    last_attempt_at: '2026-09-04T12:00:00.000Z',
    error_message: null,
    ...over,
  };
}

// BER-66: o backend não pode gravar um status novo (o CHECK da tabela só aceita
// pending|generated|failed), então "sem conteúdo" chega como failed + um
// error_message prefixado. O app precisa distinguir, senão diz "deu erro" para
// algo que não é erro do leitor nem da IA.

describe('isNoContentStatus', () => {
  it('reconhece o failed marcado como NO_CONTENT', () => {
    expect(isNoContentStatus(status({
      error_message: 'NO_CONTENT: capítulo sem conteúdo utilizável em book_contents (0 caracteres, mínimo 200)',
    }))).toBe(true);
  });

  it('não confunde com falha comum da IA', () => {
    expect(isNoContentStatus(status({ error_message: 'Error: AI timeout' }))).toBe(false);
    expect(isNoContentStatus(status({ error_message: null }))).toBe(false);
  });

  it('não marca no-content quando o status não é failed', () => {
    expect(isNoContentStatus(status({ status: 'pending', error_message: 'NO_CONTENT: x' }))).toBe(false);
    expect(isNoContentStatus(status({ status: 'generated', error_message: 'NO_CONTENT: x' }))).toBe(false);
  });

  it('tolera status ausente', () => {
    expect(isNoContentStatus(null)).toBe(false);
    expect(isNoContentStatus(undefined)).toBe(false);
  });
});

describe('quizScreenStateFor', () => {
  it('capítulo sem conteúdo vira no-content, não failed', () => {
    expect(quizScreenStateFor(status({ error_message: 'NO_CONTENT: nada aqui' }))).toBe('no-content');
  });

  it('falha comum continua sendo failed', () => {
    expect(quizScreenStateFor(status({ error_message: 'Error: 500 do provedor' }))).toBe('failed');
    expect(quizScreenStateFor(status())).toBe('failed');
  });

  it('gerado vira ready e pendente segue em polling', () => {
    expect(quizScreenStateFor(status({ status: 'generated' }))).toBe('ready');
    expect(quizScreenStateFor(status({ status: 'pending' }))).toBe('polling');
    expect(quizScreenStateFor(null)).toBe('polling');
  });
});
