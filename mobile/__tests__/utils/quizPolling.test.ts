import {
  MAX_POLL_ATTEMPTS,
  POLL_SCHEDULE_MS,
  pollDelayMs,
  shouldKeepPolling,
  totalPollWindowMs,
} from '../../src/utils/quizPolling';

describe('quizPolling (BER-40)', () => {
  it('espera pelo menos 2 minutos no total', () => {
    // O timeout antigo era 10 x 4s = 40s, menor que cold start + LLM sobre um
    // capitulo inteiro. Era por isso que o aluno via "falhou" num quiz que ficava
    // pronto pouco depois.
    expect(totalPollWindowMs()).toBeGreaterThanOrEqual(120000);
  });

  it('comeca rapido para o caso normal nao ficar lento', () => {
    expect(pollDelayMs(0)).toBeLessThanOrEqual(3000);
  });

  it('espaca as tentativas ao longo do tempo', () => {
    expect(pollDelayMs(MAX_POLL_ATTEMPTS - 1)).toBeGreaterThan(pollDelayMs(0));
  });

  it('nunca encurta o intervalo entre uma tentativa e a seguinte', () => {
    for (let i = 1; i < MAX_POLL_ATTEMPTS; i++) {
      expect(pollDelayMs(i)).toBeGreaterThanOrEqual(pollDelayMs(i - 1));
    }
  });

  it('nao passa de 20s entre tentativas', () => {
    for (let i = 0; i < MAX_POLL_ATTEMPTS + 5; i++) {
      expect(pollDelayMs(i)).toBeLessThanOrEqual(20000);
    }
  });

  it('mantem o ultimo intervalo depois do fim do schedule', () => {
    const ultimo = POLL_SCHEDULE_MS[POLL_SCHEDULE_MS.length - 1];
    expect(pollDelayMs(MAX_POLL_ATTEMPTS + 10)).toBe(ultimo);
  });

  it('trata attempt negativo sem quebrar', () => {
    expect(pollDelayMs(-1)).toBe(POLL_SCHEDULE_MS[0]);
  });

  it('para de esperar ao fim da janela', () => {
    expect(shouldKeepPolling(0)).toBe(true);
    expect(shouldKeepPolling(MAX_POLL_ATTEMPTS - 1)).toBe(true);
    expect(shouldKeepPolling(MAX_POLL_ATTEMPTS)).toBe(false);
  });
});
