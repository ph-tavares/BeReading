const mockSchedule = jest.fn((..._args: unknown[]) => Promise.resolve('id-1'));
const mockCancel = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockGetPermissoes = jest.fn(() => Promise.resolve({ granted: false, canAskAgain: true }));
const mockPedirPermissoes = jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true }));
const mockDefinirHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  getPermissionsAsync: () => mockGetPermissoes(),
  requestPermissionsAsync: () => mockPedirPermissoes(),
  setNotificationHandler: (...args: unknown[]) => mockDefinirHandler(...args),
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
  mockGetPermissoes.mockResolvedValue({ granted: false, canAskAgain: true });
  mockPedirPermissoes.mockResolvedValue({ granted: true, canAskAgain: true });
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

/**
 * A camada 2 inteira dependia de uma permissao que o app nunca pedia.
 *
 * O teste em aparelho de 21/09 (BER-124) mostrou o agendamento devolvendo id
 * valido e a notificacao nunca chegando: no iOS, agendar sem permissao
 * concedida e uma chamada que da certo e nao entrega nada. O erro, quando
 * havia, morria num catch vazio do chamador.
 */
describe('permissao de notificacao', () => {
  it('pede a permissao antes de agendar, quando ainda nao foi concedida', async () => {
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });

    await armEndAlarm(sessao, INICIO);

    expect(mockPedirPermissoes).toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('nao pede de novo quando a permissao ja esta concedida', async () => {
    mockGetPermissoes.mockResolvedValue({ granted: true, canAskAgain: false });
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });

    await armEndAlarm(sessao, INICIO);

    expect(mockPedirPermissoes).not.toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  /**
   * Permissao negada nao derruba a sessao nem vira excecao: a rede embaixo do
   * sino simplesmente nao existe, e o fim continua sendo um instante absoluto
   * gravado (BER-122).
   */
  it('nao agenda nada quando a permissao e negada', async () => {
    mockPedirPermissoes.mockResolvedValue({ granted: false, canAskAgain: false });
    const sessao = startSession({ mode: { kind: 'timed', minutes: 20 }, bookId: 'l', now: INICIO });

    const id = await armEndAlarm(sessao, INICIO);

    expect(id).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  /**
   * Sem handler, o iOS engole a notificacao quando o app esta em primeiro
   * plano, que e justamente o cenario 1 do protocolo.
   */
  it('configura a apresentacao com o app aberto', async () => {
    expect(mockDefinirHandler).toHaveBeenCalled();
  });
});
