import { todayInSaoPaulo, effectiveStreak, weekDays, streakRisk, hourInSaoPaulo } from '../../src/game/streak';

/** 21:00 em São Paulo = 00:00 UTC do dia seguinte (UTC−3). */
const spNoite = new Date('2026-09-12T00:00:00.000Z');

describe('todayInSaoPaulo', () => {
  it('usa o fuso de São Paulo, não o do aparelho', () => {
    // 00:00 UTC do dia 12 ainda é dia 11 em São Paulo.
    expect(todayInSaoPaulo(spNoite)).toBe('2026-09-11');
  });

  it('meio-dia UTC cai no mesmo dia', () => {
    expect(todayInSaoPaulo(new Date('2026-09-11T15:00:00.000Z'))).toBe('2026-09-11');
  });
});

// A Tarefa 8 (src/assistant/lines.ts) passou a importar hourInSaoPaulo direto
// daqui em vez de reimplementar o deslocamento de fuso. Até então a função só
// era exercitada indiretamente via streakRisk; agora que virou contrato
// consumido por outro módulo, merece teste direto.
describe('hourInSaoPaulo', () => {
  it('de noite', () => {
    expect(hourInSaoPaulo(new Date('2026-09-12T00:00:00.000Z'))).toBe(21);
  });

  it('de tarde', () => {
    expect(hourInSaoPaulo(new Date('2026-09-11T19:00:00.000Z'))).toBe(16);
  });

  it('de manha', () => {
    expect(hourInSaoPaulo(new Date('2026-09-11T11:00:00.000Z'))).toBe(8);
  });
});

describe('effectiveStreak', () => {
  it('mantém a sequência de quem leu hoje', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-11' }, spNoite)).toBe(4);
  });

  it('mantém a sequência de quem leu ontem — o dia ainda não acabou', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-10' }, spNoite)).toBe(4);
  });

  it('zera quando a última leitura é anterior a ontem, mesmo com o banco dizendo 4', () => {
    expect(effectiveStreak({ current_streak: 4, last_read_date: '2026-09-08' }, spNoite)).toBe(0);
  });

  it('sem última leitura, zero', () => {
    expect(effectiveStreak({ current_streak: 0, last_read_date: null }, spNoite)).toBe(0);
  });
});

describe('weekDays', () => {
  it('devolve sete dias, de segunda a domingo, marcando quem leu', () => {
    const dias = weekDays([{ read_at: '2026-09-09T14:00:00Z' }, { read_at: '2026-09-11T23:00:00Z' }], spNoite);
    expect(dias).toHaveLength(7);
    expect(dias.map((d) => d.letter)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    expect(dias.find((d) => d.date === '2026-09-09')?.read).toBe(true);
    expect(dias.find((d) => d.date === '2026-09-10')?.read).toBe(false);
  });

  it('marca hoje pelo fuso de São Paulo', () => {
    const dias = weekDays([], spNoite);
    expect(dias.filter((d) => d.isToday)).toHaveLength(1);
    expect(dias.find((d) => d.isToday)?.date).toBe('2026-09-11');
  });

  it('sessão registrada às 23h de SP conta no dia certo, não no seguinte', () => {
    // 2026-09-11 23:30 em SP = 2026-09-12 02:30 UTC
    const dias = weekDays([{ read_at: '2026-09-12T02:30:00Z' }], spNoite);
    expect(dias.find((d) => d.date === '2026-09-11')?.read).toBe(true);
  });
});

describe('streakRisk', () => {
  it('avisa depois das 18h de SP quando a sequência vale a pena', () => {
    const r = streakRisk({ streak: 4, readToday: false, now: spNoite });
    expect(r.atRisk).toBe(true);
    expect(r.hoursLeft).toBe(3);
  });

  it('não avisa quem já leu hoje', () => {
    expect(streakRisk({ streak: 4, readToday: true, now: spNoite }).atRisk).toBe(false);
  });

  it('não avisa antes das 18h', () => {
    const tarde = new Date('2026-09-11T19:00:00.000Z'); // 16h em SP
    expect(streakRisk({ streak: 4, readToday: false, now: tarde }).atRisk).toBe(false);
  });

  it('não avisa com sequência menor que 2 — não há o que perder', () => {
    expect(streakRisk({ streak: 1, readToday: false, now: spNoite }).atRisk).toBe(false);
  });

  // Fronteira exata da regra (hora >= 18): os testes acima usam 21h e 16h,
  // nenhum encosta no corte. 17h59 e 18h00 em São Paulo provam o >= certo.
  it('não avisa às 17h59 de SP, um minuto antes do corte', () => {
    const antesDoCorte = new Date('2026-09-11T20:59:00.000Z'); // 17h59 em SP
    expect(streakRisk({ streak: 4, readToday: false, now: antesDoCorte }).atRisk).toBe(false);
  });

  it('avisa exatamente às 18h00 de SP, no corte', () => {
    const noCorte = new Date('2026-09-11T21:00:00.000Z'); // 18h00 em SP
    expect(streakRisk({ streak: 4, readToday: false, now: noCorte }).atRisk).toBe(true);
  });
});
