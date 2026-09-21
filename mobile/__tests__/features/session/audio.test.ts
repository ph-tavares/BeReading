const mockSetAudioMode = jest.fn(() => Promise.resolve());
const mockPlay = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());

type Ouvinte = (estado: { isLoaded: boolean }) => void;

/**
 * Fake do `AudioPlayer` do expo-audio.
 *
 * Em aparelho o player NASCE descarregado: `createAudioPlayer` devolve na
 * hora e o carregamento termina depois, anunciado por `playbackStatusUpdate`.
 * Foi o que o teste em iPhone mostrou em 21/09 (BER-124): no instante do
 * `play()` o log trouxe `isLoaded: false` e `duration: 0`, e o som de inicio
 * simplesmente nao saia. O fake antigo nascia pronto e por isso a suite
 * inteira passava com o defeito em pe.
 */
function criarFakePlayer({ carregado = true }: { carregado?: boolean } = {}) {
  const ouvintes: Ouvinte[] = [];
  return {
    isLoaded: carregado,
    play: mockPlay,
    seekTo: mockSeekTo,
    remove: jest.fn(),
    addListener: jest.fn((_evento: string, ouvinte: Ouvinte) => {
      ouvintes.push(ouvinte);
      return { remove: jest.fn() };
    }),
    /** So para o teste: simula o carregamento terminando no aparelho. */
    terminarCarregamento(this: { isLoaded: boolean }) {
      this.isLoaded = true;
      ouvintes.forEach((o) => o({ isLoaded: true }));
    },
  };
}

let proximoPlayer: () => ReturnType<typeof criarFakePlayer>;
const mockCreatePlayer = jest.fn(() => proximoPlayer());

jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...(args as [])),
  createAudioPlayer: (...args: unknown[]) => mockCreatePlayer(...(args as [])),
}));

const mockDisarm = jest.fn(() => Promise.resolve());
jest.mock('../../../src/features/session/alarm', () => ({
  disarmEndAlarm: () => mockDisarm(),
}));

let audio: typeof import('../../../src/features/session/audio');

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  proximoPlayer = () => criarFakePlayer();
  audio = require('../../../src/features/session/audio');
});

describe('configureSessionAudio', () => {
  /**
   * Os tres valores que decidem se o sino toca ou nao. Nenhum deles e enfeite:
   *
   * - `playsInSilentMode: false` = nao toca com o aparelho no silencioso, que
   *   e exatamente como fica quem larga o celular para ler.
   * - `shouldPlayInBackground: false` = nao toca com a tela apagada, que e o
   *   caso BOM da sessao inteira.
   * - `interruptionMode` diferente de `doNotMix` quebra o
   *   `setActiveForLockScreen` no Android, e sem ele a documentacao do
   *   expo-audio diz que o audio em segundo plano morre em ~3 minutos, por
   *   limite do sistema. Sessoes aqui sao de 10 a 30.
   */
  it('liga silencioso, segundo plano e doNotMix', async () => {
    await audio.configureSessionAudio();

    expect(mockSetAudioMode).toHaveBeenCalledWith(
      expect.objectContaining({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }),
    );
  });
});

describe('o player do som', () => {
  /**
   * O defeito que o aparelho achou: `play()` num player que ainda nao
   * carregou nao toca nada. Com o app aberto o som de fim ate saia, porque a
   * tela continuava montada e o carregamento terminava a tempo; o de inicio
   * nunca saia, porque `router.replace` desmontava a tela em seguida.
   */
  it('espera o player carregar antes de chamar play', async () => {
    const player = criarFakePlayer({ carregado: false });
    proximoPlayer = () => player;

    const tocando = audio.playStartSound();
    await Promise.resolve();

    expect(mockPlay).not.toHaveBeenCalled();

    player.terminarCarregamento();
    await tocando;

    expect(mockPlay).toHaveBeenCalled();
  });

  /**
   * Um player por som, criado uma vez. Criar a cada disparo deixava o objeto
   * sem nenhuma referencia viva assim que `tocar` retornava — e o que nao tem
   * referencia o coletor leva, no meio da reproducao.
   */
  it('reaproveita o mesmo player entre disparos', async () => {
    await audio.playStartSound();
    await audio.playStartSound();

    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
  });

  /**
   * Reaproveitar o player exige voltar ao inicio: o segundo disparo comecaria
   * parado no fim do arquivo, e o leitor ouviria silencio.
   */
  it('volta ao inicio do som antes de tocar de novo', async () => {
    await audio.playStartSound();
    await audio.playStartSound();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });

  /** Sons diferentes nao podem dividir o mesmo player. */
  it('usa um player por som', async () => {
    await audio.playStartSound();
    await audio.playEndSound();

    expect(mockCreatePlayer).toHaveBeenCalledTimes(2);
  });
});

describe('playEndSound', () => {
  /**
   * A notificacao e rede embaixo do sino, nao um segundo sino. Se o audio
   * tocou, a rede sai de cena — senao o leitor ouve o fim duas vezes.
   */
  it('desarma a notificacao de rede ao tocar', async () => {
    await audio.playEndSound();

    expect(mockPlay).toHaveBeenCalled();
    expect(mockDisarm).toHaveBeenCalled();
  });
});

describe('playStopSound', () => {
  /**
   * Encerrar antes da hora e o caso em que a rede NAO pode ficar armada: a
   * sessao acabou, e a notificacao de "tempo acabou" chegava minutos depois.
   * O desarme vem antes do som, entao um som que falha nao deixa o sino
   * agendado.
   */
  it('desarma a notificacao antes de tocar', async () => {
    const ordem: string[] = [];
    mockDisarm.mockImplementationOnce(() => { ordem.push('desarma'); return Promise.resolve(); });
    mockPlay.mockImplementationOnce(() => { ordem.push('toca'); });

    await audio.playStopSound();

    expect(ordem).toEqual(['desarma', 'toca']);
  });
});
