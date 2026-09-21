const mockSchedule = jest.fn((..._args: unknown[]) => Promise.resolve('id-1'));
const mockCancel = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { startSession } from '../../../src/features/session/logic';

const INICIO = new Date('2026-09-20T22:00:00.000Z');

/**
 * O modulo guarda o id do que esta armado — e isso e o desenho certo para
 * producao (a tela remonta, o app volta do segundo plano, e um estado de
 * componente deixaria sinos orfaos). Em teste, porem, esse estado vazaria de
 * um caso para o outro e a ordem passaria a importar. Cada caso recarrega o
 * modulo do zero.
 */
let armEndAlarm: typeof import('../../../src/features/session/alarm').armEndAlarm;
let disarmEndAlarm: typeof import('../../../src/features/session/alarm').disarmEndAlarm;

beforeEach(() => {
  jest.clearAllMocks();
  mockSchedule.mockResolvedValue('id-1');
  jest.resetModules();
  const modulo = require('../../../src/features/session/alarm');
  armEndAlarm = modulo.armEndAlarm;
  disarmEndAlarm = modulo.disarmEndAlarm;
});

describe('armEndAlarm', () => {
  /**
   * A notificacao e agendada no MESMO instante que a sessao gravou como fim.
   * Um sino e uma notificacao em horarios diferentes seria pior que so um dos
   * dois: o leitor ouviria o fim duas vezes, em momentos distintos.
   */
  it('agenda no instante gravado como fim da sessao', async () => {
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });

    await armEndAlarm(sessao, INICIO);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const pedido = mockSchedule.mock.calls[0][0] as { trigger: { date: Date } };
    expect(pedido.trigger.date).toEqual(new Date('2026-09-20T22:20:00.000Z'));
  });

  it('nao agenda nada na sessao sem tempo definido', async () => {
    const sessao = startSession({ mode: { kind: 'open' }, bookId: 'l', now: INICIO });

    const id = await armEndAlarm(sessao, INICIO);

    expect(id).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  /**
   * Armar duas vezes sem desarmar deixaria dois sinos agendados, e o leitor
   * ouviria o fim em duplicata. Acontece de verdade: a tela remonta, o app
   * volta do segundo plano, o efeito roda de novo.
   */
  it('armar de novo desarma o anterior, para nao existirem dois sinos', async () => {
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });
    mockSchedule.mockResolvedValueOnce('id-1').mockResolvedValueOnce('id-2');

    await armEndAlarm(sessao, INICIO);
    await armEndAlarm(sessao, INICIO);

    expect(mockCancel).toHaveBeenCalledWith('id-1');
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });
});

describe('disarmEndAlarm', () => {
  it('cancela o que estiver armado', async () => {
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });
    await armEndAlarm(sessao, INICIO);

    await disarmEndAlarm();

    expect(mockCancel).toHaveBeenCalledWith('id-1');
  });

  /**
   * Sem nada armado, desarmar nao pode explodir nem cancelar a esmo: e
   * chamado no caminho normal de encerrar a sessao.
   */
  it('sem nada armado, nao faz nada', async () => {
    await disarmEndAlarm();

    expect(mockCancel).not.toHaveBeenCalled();
  });
});
