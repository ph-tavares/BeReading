// O som da sessao (BER-124, spec §5, camada 1 — o caminho principal).
//
// ⚠️ OS ARQUIVOS SAO PROVISORIOS. `assets/audio/inicio.wav` e `fim.wav` sao
// sintetizados por `scripts/gerar-sons.mjs`, trabalho do proprio time, sem
// licenca de terceiro envolvida — o repositorio e publico e o mascote gerado
// por IA ja e risco de licenca aberto desde 20/09/2026. Escolher o som de
// verdade e pendencia do time (spec §11); quando acontecer, troque os dois
// arquivos e registre a licenca, se vier de fora.
import { setAudioModeAsync, createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { disarmEndAlarm } from './alarm';

const INICIO = require('../../../assets/audio/inicio.wav');
const FIM = require('../../../assets/audio/fim.wav');
const ENCERRAR = require('../../../assets/audio/encerrar.wav');

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

/**
 * Um player por som, criado na primeira vez e guardado aqui.
 *
 * Criar um player a cada disparo foi metade do defeito que o teste em
 * aparelho achou em 21/09 (BER-124): o objeto ficava sem nenhuma referencia
 * viva assim que `tocar` retornava, e o que nao tem referencia o coletor
 * leva — no meio da reproducao, ou antes dela comecar.
 *
 * A chave e o NOME do som, e nao o valor que o require do .wav devolve: esse
 * valor e um detalhe do bundler (no Metro cada asset vira um numero distinto,
 * mas nada no contrato promete isso), e depender dele fazia os dois sons
 * dividirem um player so.
 */
type Som = 'inicio' | 'fim' | 'encerrar';

const players = new Map<Som, AudioPlayer>();

function obter(nome: Som, fonte: number): AudioPlayer {
  const existente = players.get(nome);
  if (existente) return existente;

  const novo = createAudioPlayer(fonte);
  players.set(nome, novo);
  return novo;
}

/**
 * Teto da espera pelo carregamento. Existe para o sino nao ficar pendurado
 * para sempre num player que nunca carrega (arquivo corrompido, disco
 * ocupado): se estourar, tenta tocar assim mesmo, porque um som que talvez
 * saia e melhor que uma promessa que nunca resolve. A corretude da sessao nao
 * depende disto — o fim e um instante absoluto gravado (BER-122).
 */
const ESPERA_CARREGAR_MS = 3000;

/**
 * A outra metade do defeito. `createAudioPlayer` devolve na hora, mas o
 * carregamento e assincrono: o log do iPhone mostrou `isLoaded: false` e
 * `duration: 0` no instante em que o codigo antigo chamava `play()`. Chamar
 * `play()` ali nao toca nada.
 *
 * Com o app aberto o som de FIM ate saia, porque a tela continuava montada e
 * o carregamento terminava a tempo; o de INICIO nunca saia, porque
 * `router.replace` desmontava a tela logo em seguida.
 */
function aguardarCarregar(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let encerrado = false;
    let inscricao: { remove: () => void } | null = null;
    let relogio: ReturnType<typeof setTimeout> | null = null;

    const terminar = () => {
      if (encerrado) return;
      encerrado = true;
      if (relogio !== null) clearTimeout(relogio);
      inscricao?.remove();
      resolve();
    };

    inscricao = player.addListener('playbackStatusUpdate', (estado) => {
      if (estado.isLoaded) terminar();
    });
    relogio = setTimeout(terminar, ESPERA_CARREGAR_MS);

    // O carregamento pode ter terminado entre a leitura de `isLoaded` la em
    // cima e a inscricao: nesse caso o evento ja passou e ninguem mais avisa.
    if (player.isLoaded) terminar();
  });
}

async function tocar(nome: Som, fonte: number): Promise<void> {
  const player = obter(nome, fonte);
  await aguardarCarregar(player);
  // O player e reaproveitado, entao o disparo anterior o deixou parado no fim
  // do arquivo. Sem voltar ao inicio, o segundo som e silencio.
  await player.seekTo(0);
  player.play();
}

export async function playStartSound(): Promise<void> {
  await tocar('inicio', INICIO);
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
  await tocar('fim', FIM);
  await disarmEndAlarm();
}

/**
 * O leitor encerrou antes da hora. Desarma a notificacao ANTES de tocar: sem
 * isso o sino de rede continuava agendado e chegava minutos depois dizendo
 * que o tempo tinha acabado, com a sessao ja encerrada.
 */
export async function playStopSound(): Promise<void> {
  await disarmEndAlarm();
  await tocar('encerrar', ENCERRAR);
}
