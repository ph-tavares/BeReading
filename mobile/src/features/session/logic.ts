// Logica pura da sessao de leitura (BER-122). Sem import de React nem de
// primitivo visual: so dado e conta.
//
// A regra que manda em tudo aqui: o fim da sessao e um INSTANTE ABSOLUTO
// gravado no inicio, nunca uma contagem em memoria (spec S7/§5). O numero na
// tela, o agendamento do som e a recuperacao derivam todos de `endsAt`. E o
// que faz a sessao continuar certa quando a tela apaga, o app e' congelado ou
// o sino falha — o defeito que o concorrente Leio tem registrado em
// reclamacao de loja ("o cronometro reinicia quando a tela apaga").

/** Como o leitor escolheu ler: com tempo marcado, ou ate quando quiser. */
export type SessionMode =
  | { kind: 'timed'; minutes: number }
  | { kind: 'open' };

export interface ActiveSession {
  /** Instante em que a sessao comecou, ISO. */
  startedAt: string;
  /** Instante do fim previsto, ISO. `null` quando nao ha tempo definido. */
  endsAt: string | null;
  mode: SessionMode;
  bookId: string;
}

export function startSession({
  mode,
  bookId,
  now = new Date(),
}: {
  mode: SessionMode;
  bookId: string;
  now?: Date;
}): ActiveSession {
  const startedAt = now.toISOString();
  const endsAt =
    mode.kind === 'timed'
      ? new Date(now.getTime() + mode.minutes * 60_000).toISOString()
      : null;

  return { startedAt, endsAt, mode, bookId };
}

/**
 * Quanto falta, em milissegundos, para o fim previsto.
 *
 * Repare no que esta funcao NAO faz: ela nao acumula tique, nao le contador
 * nenhum e nao se importa com o que o app fez no meio. So existe a subtracao
 * entre `endsAt` e agora. E por isso que a sessao sobrevive a tela apagada,
 * ao app congelado e ao sino que falhou.
 */
export function remainingMs(session: ActiveSession, now: Date = new Date()): number | null {
  if (session.endsAt === null) return null;
  return Date.parse(session.endsAt) - now.getTime();
}

/**
 * Ha quanto tempo a sessao corre, em milissegundos. Mesma origem do
 * `remainingMs`: a diferenca entre dois instantes gravados. Serve a sessao
 * sem tempo definido, que mostra o tempo subindo em vez de descendo, e ao
 * resumo do fim.
 */
export function elapsedMs(session: ActiveSession, now: Date = new Date()): number {
  return now.getTime() - Date.parse(session.startedAt);
}

/**
 * Se o fim previsto ja chegou. Sessao sem tempo definido devolve sempre
 * `false`: ela nao acaba sozinha, quem encerra e o leitor. O teto de 1 hora
 * da spec §6 e' regra de RECUPERACAO, para quando o app morreu (BER-126), e
 * nao vale com o app vivo na mao da pessoa.
 */
export function isFinished(session: ActiveSession, now: Date = new Date()): boolean {
  const falta = remainingMs(session, now);
  return falta !== null && falta <= 0;
}

export const TIME_PRESETS = {
  /**
   * Os atalhos da tela. **Nada de 25 minutos por causa do Pomodoro** (BER-122):
   * nao existe ensaio que sustente esse numero, e o estudo disponivel mostra
   * que o numero nao importa — blocos de 24/6 e de 12/3 deram praticamente
   * igual em fadiga, distracao e concentracao. O que ganha e' ter estrutura
   * definida ANTES de comecar, que e' o que estes atalhos entregam.
   */
  minutes: [10, 20, 30] as const,
  /**
   * Teto do campo "tempo personalizado".
   *
   * ⚠️ Este numero NAO esta na spec: e' guarda de entrada, nao regra de
   * produto. Existe para 99999 digitado sem querer nao virar uma sessao de
   * 69 dias. Se o time quiser um limite de produto com motivo, ele substitui
   * este valor — e ai o comentario muda junto.
   */
  maxCustomMinutes: 240,
};

/**
 * Le o campo de tempo personalizado. Devolve `null` para tudo que nao seja um
 * numero inteiro de minutos dentro do teto — e a tela nao deixa comecar.
 *
 * Zero e negativo nao sao "sessao curta", sao sessao nenhuma. Fracao de
 * minuto nao tem como ser digitada de proposito num teclado numerico.
 */
export function parseCustomMinutes(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+$/.test(limpo)) return null;

  const minutos = Number(limpo);
  if (minutos < 1 || minutos > TIME_PRESETS.maxCustomMinutes) return null;

  return minutos;
}

/**
 * O relogio da tela, em `MM:SS`.
 *
 * Passa de 60 minutos sem reiniciar (`75:00`, nao `15:00`): a sessao sem
 * tempo definido sobe indefinidamente, e virar a contagem esconderia uma hora
 * inteira de leitura.
 *
 * Tempo negativo vira `00:00`. Ele acontece de verdade — a sessao terminou
 * enquanto o app estava congelado e a tela abre depois do instante gravado —
 * e mostrar "-03:12" seria vazar a conta interna para o leitor.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

/**
 * Quando o alarme de fim deve disparar, ou `null` quando nao ha o que agendar.
 *
 * E o MESMO instante que a sessao gravou como fim (BER-124): o sino e a
 * notificacao de rede saem os dois daqui, entao nao existe a possibilidade de
 * um tocar num horario e o outro noutro.
 *
 * Dois casos devolvem `null`: sessao sem tempo definido, porque quem encerra
 * e o leitor e um sino tocando sozinho seria um fim que ninguem pediu; e
 * instante que ja passou, porque reabrir o app depois do fim precisa levar a
 * tela de fim, nao disparar um alarme atrasado.
 */
export function endAlarmAt(session: ActiveSession, now: Date = new Date()): Date | null {
  if (session.endsAt === null) return null;

  const fim = new Date(session.endsAt);
  if (fim.getTime() <= now.getTime()) return null;

  return fim;
}

