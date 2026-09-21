// A rede embaixo do sino (BER-124, spec §5, camada 2).
//
// O som do proprio app e o caminho principal. Esta notificacao local existe
// porque ele pode falhar, e o benchmark prova que falha: o Insight Timer toca
// pela sessao de audio dele, NAO promete funcionar com a tela apagada (o help
// centre manda desligar o bloqueio automatico no iOS e liberar a bateria no
// Android), e mesmo assim tem reclamacao de loja de sino que nao toca, de 2020
// a 2026.
//
// Dois furos conhecidos desta camada, que o PR declara em vez de esconder:
// som personalizado em notificacao NAO funciona no Expo Go, e notificacao nao
// toca com o aparelho no silencioso. No Android o agendamento e inexato — a
// documentacao do proprio Android admite entrega "within one hour", entao nada
// aqui promete precisao la.
//
// A regra que vale mais que as duas camadas continua sendo a da BER-122: o fim
// da sessao e um instante absoluto gravado. Se o sino e a notificacao falharem
// os dois, a sessao ainda esta correta quando o leitor abre o app.
import * as Notifications from 'expo-notifications';
import { endAlarmAt, type ActiveSession } from './logic';

/**
 * O id do que esta agendado agora. Modulo, e nao estado de componente, porque
 * a tela remonta e o app volta do segundo plano — e cada uma dessas coisas
 * rodaria o efeito de novo, deixando um sino orfao agendado para o mesmo
 * instante. O leitor ouviria o fim em duplicata.
 */
let armado: string | null = null;

/**
 * Com o app em primeiro plano o iOS NAO apresenta a notificacao por conta
 * propria: sem handler, ela chega e o leitor nao ve nem ouve nada. E o
 * cenario 1 do protocolo da BER-124.
 *
 * Fica no escopo do modulo, e nao num efeito de tela, porque precisa valer
 * antes de a primeira notificacao chegar, venha ela de onde vier.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Sem permissao concedida, `scheduleNotificationAsync` no iOS **da certo e
 * nao entrega nada**: devolve um id valido e a notificacao nunca chega. Foi
 * exatamente o que o teste em aparelho de 21/09 registrou, e como o chamador
 * engolia erro num catch vazio, nada disso aparecia.
 *
 * Pedir so quando ainda nao ha resposta: o iOS mostra o dialogo do sistema
 * uma unica vez por instalacao, e insistir depois de negado nao reabre nada.
 */
async function garantirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;

  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

export async function armEndAlarm(
  session: ActiveSession,
  now: Date = new Date(),
): Promise<string | null> {
  const quando = endAlarmAt(session, now);
  if (quando === null) return null;

  // Permissao negada nao derruba a sessao: a rede embaixo do sino deixa de
  // existir, e o fim continua sendo um instante absoluto gravado (BER-122).
  if (!(await garantirPermissao())) return null;

  await disarmEndAlarm();

  armado = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Seu tempo de leitura acabou.',
      body: 'Até que página você foi?',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: quando,
    },
  });

  return armado;
}

export async function disarmEndAlarm(): Promise<void> {
  if (armado === null) return;

  const id = armado;
  // Zera ANTES de esperar: se o cancelamento falhar, a alternativa e ficar
  // achando para sempre que ainda ha algo armado, e nunca mais agendar nada.
  armado = null;
  await Notifications.cancelScheduledNotificationAsync(id);
}
