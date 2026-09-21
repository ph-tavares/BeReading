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

export async function armEndAlarm(
  session: ActiveSession,
  now: Date = new Date(),
): Promise<string | null> {
  const quando = endAlarmAt(session, now);
  if (quando === null) return null;

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
