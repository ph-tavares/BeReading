import { startSession, remainingMs, elapsedMs, isFinished, parseCustomMinutes, TIME_PRESETS, formatClock } from '../../../src/features/session/logic';

describe('startSession', () => {
  it('com tempo definido, grava o fim como instante absoluto', () => {
    const agora = new Date('2026-09-20T22:00:00.000Z');

    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'livro-1', now: agora });

    expect(sessao.startedAt).toBe('2026-09-20T22:00:00.000Z');
    expect(sessao.endsAt).toBe('2026-09-20T22:20:00.000Z');
  });

  it('sem tempo definido, nao tem fim previsto', () => {
    const agora = new Date('2026-09-20T22:00:00.000Z');

    const sessao = startSession({ mode: { kind: 'open' }, bookId: 'livro-1', now: agora });

    expect(sessao.startedAt).toBe('2026-09-20T22:00:00.000Z');
    expect(sessao.endsAt).toBeNull();
  });
});

describe('remainingMs', () => {
  /**
   * O teste que guarda a regra central: nada aqui conta tique. A sessao pode
   * ter passado 15 minutos com o app congelado e a tela apagada — que e o
   * caso BOM, a pessoa lendo — e o tempo restante continua saindo da conta
   * entre `endsAt` e agora. E o defeito que o concorrente Leio tem em
   * reclamacao de loja: "o cronometro reinicia quando a tela apaga".
   */
  it('sai da diferenca ate o instante gravado, sem depender de tique nenhum', () => {
    const inicio = new Date('2026-09-20T22:00:00.000Z');
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'livro-1', now: inicio });

    const quinzeMinutosDepois = new Date('2026-09-20T22:15:00.000Z');

    expect(remainingMs(sessao, quinzeMinutosDepois)).toBe(5 * 60_000);
  });

  /**
   * Zero significaria "acabou agora", que e' uma afirmacao. Sessao sem tempo
   * definido nao tem fim previsto, e a tela que mostra contagem regressiva
   * precisa distinguir "nao ha o que contar" de "chegou ao fim".
   */
  it('e nulo na sessao sem tempo definido: nao ha o que contar', () => {
    const inicio = new Date('2026-09-20T22:00:00.000Z');
    const sessao = startSession({ mode: { kind: 'open' }, bookId: 'livro-1', now: inicio });

    expect(remainingMs(sessao, new Date('2026-09-20T22:15:00.000Z'))).toBeNull();
  });
});

describe('elapsedMs', () => {
  it('conta do inicio gravado ate agora, nas duas formas de sessao', () => {
    const inicio = new Date('2026-09-20T22:00:00.000Z');
    const agora = new Date('2026-09-20T22:15:00.000Z');

    const marcada = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: inicio });
    const aberta = startSession({ mode: { kind: 'open' }, bookId: 'l', now: inicio });

    expect(elapsedMs(marcada, agora)).toBe(15 * 60_000);
    expect(elapsedMs(aberta, agora)).toBe(15 * 60_000);
  });
});

describe('isFinished', () => {
  const inicio = new Date('2026-09-20T22:00:00.000Z');

  it('a sessao marcada acaba quando o instante gravado chega', () => {
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: inicio });

    expect(isFinished(sessao, new Date('2026-09-20T22:19:59.000Z'))).toBe(false);
    expect(isFinished(sessao, new Date('2026-09-20T22:20:00.000Z'))).toBe(true);
  });

  /**
   * Sessao sem tempo definido nao acaba sozinha, por mais que demore: quem
   * encerra e o leitor. O teto de 1 hora existe na recuperacao (BER-126),
   * para o caso de o app ter morrido — nao aqui, com o app vivo.
   */
  it('a sessao sem tempo definido nunca acaba sozinha', () => {
    const sessao = startSession({ mode: { kind: 'open' }, bookId: 'l', now: inicio });

    expect(isFinished(sessao, new Date('2026-09-21T06:00:00.000Z'))).toBe(false);
  });
});

describe('parseCustomMinutes', () => {
  it('aceita minutos inteiros dentro do limite', () => {
    expect(parseCustomMinutes('45')).toBe(45);
    expect(parseCustomMinutes(' 7 ')).toBe(7);
  });

  /**
   * Tudo que nao e' um numero inteiro de minutos vira `null`, e a tela nao
   * deixa comecar. Zero e negativo nao sao "sessao curta", sao sessao
   * nenhuma; fracao de minuto nao tem como ser digitada de proposito.
   */
  it('recusa o que nao seja um numero inteiro de minutos', () => {
    expect(parseCustomMinutes('')).toBeNull();
    expect(parseCustomMinutes('0')).toBeNull();
    expect(parseCustomMinutes('-5')).toBeNull();
    expect(parseCustomMinutes('abc')).toBeNull();
    expect(parseCustomMinutes('20,5')).toBeNull();
  });

  it('recusa acima do teto de guarda', () => {
    expect(parseCustomMinutes(String(TIME_PRESETS.maxCustomMinutes))).toBe(TIME_PRESETS.maxCustomMinutes);
    expect(parseCustomMinutes(String(TIME_PRESETS.maxCustomMinutes + 1))).toBeNull();
  });
});

describe('formatClock', () => {
  it('mostra minutos e segundos, com zero a esquerda', () => {
    expect(formatClock(20 * 60_000)).toBe('20:00');
    expect(formatClock(9 * 60_000 + 5_000)).toBe('09:05');
    expect(formatClock(0)).toBe('00:00');
  });

  it('passa de uma hora sem reiniciar a contagem de minutos', () => {
    expect(formatClock(75 * 60_000)).toBe('75:00');
  });

  /**
   * Tempo negativo acontece de verdade: a sessao terminou enquanto o app
   * estava congelado, e a tela abre depois do instante gravado. Mostrar
   * "-03:12" seria vazar a conta interna para o leitor.
   */
  it('nao mostra tempo negativo quando o fim ja passou', () => {
    expect(formatClock(-3 * 60_000)).toBe('00:00');
  });
});
