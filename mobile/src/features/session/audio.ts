// O som da sessao (BER-124, spec §5, camada 1 — o caminho principal).
//
// ⚠️ OS ARQUIVOS SAO PROVISORIOS. `assets/audio/inicio.wav` e `fim.wav` sao
// sintetizados por `scripts/gerar-sons.mjs`, trabalho do proprio time, sem
// licenca de terceiro envolvida — o repositorio e publico e o mascote gerado
// por IA ja e risco de licenca aberto desde 20/09/2026. Escolher o som de
// verdade e pendencia do time (spec §11); quando acontecer, troque os dois
// arquivos e registre a licenca, se vier de fora.
import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { disarmEndAlarm } from './alarm';

const INICIO = require('../../../assets/audio/inicio.wav');
const FIM = require('../../../assets/audio/fim.wav');

/**
 * Os tres valores que decidem se o sino toca. Nenhum e enfeite, e o
 * `__tests__/features/session/audio.test.ts` trava os tres:
 *
 * - `playsInSilentMode`: sem isso nao toca no silencioso, que e exatamente
 *   como fica o aparelho de quem larga o celular para ler.
 * - `shouldPlayInBackground`: sem isso nao toca com a tela apagada, que e o
 *   caso BOM da sessao inteira.
 * - `interruptionMode: 'doNotMix'`: exigido pelo `setActiveForLockScreen`, e
 *   sem ele a documentacao do expo-audio diz que o audio em segundo plano no
 *   Android morre em ~3 minutos, por limite do sistema. Sessoes aqui sao de
 *   10 a 30 minutos, entao 3 nao serve para nada.
 *
 * ⚠️ Isto NAO prova que o som toca. A documentacao do Expo diz que audio em
 * segundo plano no iOS "is only available in standalone apps", enquanto o
 * Info.plist do proprio Expo Go declara o modo de audio. Nao ha resposta no
 * papel: so teste em aparelho decide, e e criterio de aceite da BER-124.
 */
export async function configureSessionAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
}

async function tocar(fonte: number): Promise<void> {
  const player = createAudioPlayer(fonte);
  player.play();
}

export async function playStartSound(): Promise<void> {
  await tocar(INICIO);
}

/**
 * Toca o fim e **desarma a notificacao de rede**. A notificacao e rede embaixo
 * do sino, nao um segundo sino: se o audio tocou, ela sai de cena, senao o
 * leitor ouve o fim duas vezes.
 *
 * O desarme mora aqui, e nao no chamador, para nao existir um caminho em que
 * alguem toca o som e esquece de cancelar.
 */
export async function playEndSound(): Promise<void> {
  await tocar(FIM);
  await disarmEndAlarm();
}
