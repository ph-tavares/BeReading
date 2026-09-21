const mockSetAudioMode = jest.fn(() => Promise.resolve());
const mockPlay = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());
const mockCreatePlayer = jest.fn(() => ({ play: mockPlay, seekTo: mockSeekTo, remove: jest.fn() }));

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
