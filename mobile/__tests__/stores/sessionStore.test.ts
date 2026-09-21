import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionStore } from '../../src/stores/sessionStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSessionStore.setState({ active: null, lastMode: { kind: 'timed', minutes: 20 }, keepAwake: false, hydrated: false });
});

describe('sessionStore', () => {
  /**
   * O teste que sustenta a recuperacao (BER-126): a sessao tem que sobreviver
   * a morte do app. Aqui isso e' simulado zerando o estado em memoria, como
   * se o processo tivesse sido derrubado, e hidratando de novo.
   */
  it('a sessao iniciada sobrevive ao app morrer', async () => {
    const inicio = new Date('2026-09-20T22:00:00.000Z');
    await useSessionStore.getState().begin({ mode: { kind: 'timed', minutes: 20 }, bookId: 'livro-1', now: inicio });

    // O app morreu: nada em memoria.
    useSessionStore.setState({ active: null, hydrated: false });
    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().active).toEqual({
      startedAt: '2026-09-20T22:00:00.000Z',
      endsAt: '2026-09-20T22:20:00.000Z',
      mode: { kind: 'timed', minutes: 20 },
      bookId: 'livro-1',
    });
  });

  /**
   * Criterio de aceite da BER-122: os atalhos abrem com "o ultimo usado
   * pre-selecionado". Ele tambem tem que atravessar a morte do app, senao a
   * tela volta ao padrao toda vez que o sistema derruba o processo.
   */
  it('lembra o ultimo tempo escolhido, inclusive depois de o app morrer', async () => {
    await useSessionStore.getState().begin({ mode: { kind: 'timed', minutes: 30 }, bookId: 'livro-1' });

    useSessionStore.setState({ active: null, lastMode: { kind: 'timed', minutes: 20 }, keepAwake: false, hydrated: false });
    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().lastMode).toEqual({ kind: 'timed', minutes: 30 });
  });

  it('sem nada gravado, hidrata no padrao e marca que ja rodou', async () => {
    await useSessionStore.getState().hydrate();

    const estado = useSessionStore.getState();
    expect(estado.active).toBeNull();
    expect(estado.hydrated).toBe(true);
  });

  /**
   * BER-124, terceira camada: "manter a tela acesa" e a garantia de quem nao
   * quer depender de sino nenhum. E preferencia, entao atravessa a morte do
   * app junto com o resto.
   */
  it('lembra a preferencia de manter a tela acesa', async () => {
    await useSessionStore.getState().setKeepAwake(true);

    useSessionStore.setState({ keepAwake: false, hydrated: false });
    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().keepAwake).toBe(true);
  });

  /**
   * Encerrar tem de apagar a sessao tambem do aparelho. So navegar deixava a
   * sessao ativa por tras, e ela voltava na proxima hidratacao.
   */
  it('encerrar tira a sessao da memoria e do aparelho, e guarda o ultimo tempo', async () => {
    await useSessionStore.getState().begin({ mode: { kind: 'timed', minutes: 30 }, bookId: 'livro-1' });
    await useSessionStore.getState().end();

    expect(useSessionStore.getState().active).toBeNull();

    useSessionStore.setState({ active: null, hydrated: false });
    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().active).toBeNull();
    expect(useSessionStore.getState().lastMode).toEqual({ kind: 'timed', minutes: 30 });
  });
});
