// Sequência de leitura, no mesmo fuso do servidor (BER-77).
//
// O register-reading-session vira o dia em São Paulo (getTodayInSaoPaulo, em
// register-reading-session/reading.ts). Se o app usasse o fuso do aparelho,
// quem lê às 23h de Lisboa veria a sequência de outro dia — e o alerta de risco
// mentiria. Esta é a mesma conta, espelhada no cliente.

const SAOPAULO_OFFSET = -3;
const MS_PER_HOUR = 3_600_000;

/** Data (YYYY-MM-DD) em São Paulo. Espelha getTodayInSaoPaulo do servidor. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return dateInSaoPaulo(now).toISOString().split('T')[0];
}

/**
 * O instante deslocado para o relógio de São Paulo. Só para ler campos UTC.
 *
 * `now.getTime()` já é um instante absoluto (epoch), independente de fuso —
 * por isso o deslocamento é só a constante fixa. Somar `now.getTimezoneOffset()`
 * (o fuso do aparelho que roda o teste ou o app) reintroduziria a exata
 * dependência que este módulo existe para eliminar: no aparelho configurado
 * em America/Sao_Paulo os dois deslocamentos se cancelam e a função vira
 * no-op; em qualquer outro fuso o resultado erra por um valor diferente.
 */
function dateInSaoPaulo(now: Date): Date {
  return new Date(now.getTime() + SAOPAULO_OFFSET * MS_PER_HOUR);
}

/**
 * Hora do relógio (0-23) em São Paulo. Exportada porque a Tarefa 8
 * (`src/assistant/lines.ts`) também precisa da hora local para escolher a
 * saudação — duas cópias da virada de dia divergem no primeiro ajuste, e é
 * justamente essa conta que precisa bater com o servidor.
 */
export function hourInSaoPaulo(now: Date = new Date()): number {
  return dateInSaoPaulo(now).getUTCHours();
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * A sequência que vale hoje.
 *
 * `streaks.current_streak` só é reescrito no próximo registro: quem parou há
 * três dias continua com 4 gravado no banco. Mostrar esse número seria mentir.
 * Vale enquanto a última leitura foi hoje ou ontem.
 */
export function effectiveStreak(
  streak: { current_streak: number; last_read_date: string | null },
  now: Date = new Date(),
): number {
  if (!streak.last_read_date) return 0;
  const hoje = todayInSaoPaulo(now);
  const ontem = addDays(hoje, -1);
  if (streak.last_read_date === hoje || streak.last_read_date === ontem) {
    return streak.current_streak;
  }
  return 0;
}

export interface WeekDay {
  date: string;
  letter: string;
  read: boolean;
  isToday: boolean;
}

const LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Segunda a domingo da semana corrente, marcando os dias com leitura. */
export function weekDays(
  sessions: { read_at: string }[],
  now: Date = new Date(),
): WeekDay[] {
  const hoje = todayInSaoPaulo(now);
  const dow = new Date(`${hoje}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const segunda = addDays(hoje, offsetToMonday);

  // A sessão é datada pelo dia em SP, não pelo UTC do read_at: leitura às 23h
  // de SP cairia no dia seguinte se comparássemos a string crua.
  const lidos = new Set(sessions.map((s) => todayInSaoPaulo(new Date(s.read_at))));

  return LETTERS.map((letter, i) => {
    const date = addDays(segunda, i);
    return { date, letter, read: lidos.has(date), isToday: date === hoje };
  });
}

/** Depois das 18h de SP, sem leitura hoje e com sequência que valha a pena. */
export function streakRisk({
  streak,
  readToday,
  now = new Date(),
}: {
  streak: number;
  readToday: boolean;
  now?: Date;
}): { atRisk: boolean; hoursLeft: number } {
  const hora = hourInSaoPaulo(now);
  const hoursLeft = 24 - hora;
  const atRisk = !readToday && streak >= 2 && hora >= 18;
  return { atRisk, hoursLeft };
}
