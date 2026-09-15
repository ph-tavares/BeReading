// Logica pura da tela Hoje (BER-77, F4 Tarefa 4). Sem import de React nem de
// primitivo visual: so dado e conta, para o teste checar produto e nao forma.
import type { Chapter, ReadingSession } from '../../types/database';
import { todayInSaoPaulo, streakRisk } from '../../game/streak';

export interface ChapterGoal {
  chapterNumber: number;
  totalChapters: number;
  remainingPages: number;
}

/**
 * O capitulo corrente e quanto falta para fecha-lo, a partir da paginacao
 * real dos capitulos do livro.
 *
 * BER-72: a migration deixou `start_page`/`end_page` opcionais em `chapters`
 * (nem toda fonte de catalogo tem paginacao por capitulo). Um capitulo sem
 * `end_page` nao pode virar meta: mostrar numero chutado e pior que nao
 * mostrar nada. Por isso o capitulo candidato e o PRIMEIRO, em ordem de
 * numero, que tem `end_page` numerico e ainda nao foi alcancado pela pagina
 * atual — pulando os que nao tem paginacao, em vez de travar neles.
 *
 * Achado da revisao da Tarefa 4: "pular" o capitulo sem paginacao nao basta.
 * Com capitulos 1 (end 30), 2 (sem paginacao) e 3 (start 61, end 90), a
 * pagina 50 esta depois do capitulo 1 mas ANTES do inicio do capitulo 3 — o
 * leitor esta em algum ponto do capitulo 2, sem paginacao pra confirmar
 * onde. Apontar "capitulo 3" seria o mesmo numero chutado que a funcao
 * existe pra evitar.
 *
 * A primeira correcao testou isso pelo `start_page` do candidato, e deixava
 * um buraco que o proprio implementador declarou: capitulo com `end_page` e
 * `start_page` nulo passava direto. As duas colunas sao nulaveis de forma
 * independente, entao a mesma cena com o capitulo 3 sem `start_page` voltava
 * a mentir.
 *
 * A pergunta de fundo e sempre a mesma: **da pra provar que o leitor esta
 * dentro deste capitulo?** Existem duas provas independentes, e basta uma:
 *
 * - o candidato tem `start_page` numerico e a pagina atual ja o alcancou. Isso
 *   fixa o leitor dentro dele, e nao importa o que veio antes;
 * - o candidato nao tem `start_page`, e ai a unica saida e a corrida paginada:
 *   se todo capitulo anterior tem `end_page`, o leitor provadamente passou por
 *   todos, e o candidato termina depois da pagina atual.
 *
 * Sem nenhuma das duas, a posicao e indeterminada, e indeterminado nao vira
 * numero na tela.
 */
export function currentChapterGoal(
  chapters: Pick<Chapter, 'number' | 'start_page' | 'end_page'>[],
  currentPage: number,
): ChapterGoal | null {
  const ordenados = [...chapters].sort((a, b) => a.number - b.number);
  const indice = ordenados.findIndex(
    (c) => typeof c.end_page === 'number' && c.end_page > currentPage,
  );
  if (indice === -1) return null;

  const atual = ordenados[indice];
  if (typeof atual.end_page !== 'number') return null;

  if (typeof atual.start_page === 'number') {
    // Prova direta. Se a pagina atual ainda nao chegou ao inicio, ela cai no
    // vao entre o capitulo anterior e este, que nao e capitulo nenhum.
    if (currentPage < atual.start_page) return null;
  } else {
    // Sem inicio declarado, so a corrida paginada anterior prova a posicao.
    const anteriores = ordenados.slice(0, indice);
    if (anteriores.some((c) => typeof c.end_page !== 'number')) return null;
  }

  return {
    chapterNumber: atual.number,
    totalChapters: ordenados.length,
    remainingPages: atual.end_page - currentPage,
  };
}

/** Diferenca em dias corridos entre duas datas AAAA-MM-DD (meia-noite UTC). */
function diasEntre(inicio: string, fim: string): number {
  const ms = Date.parse(`${fim}T00:00:00.000Z`) - Date.parse(`${inicio}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Dias corridos (fuso de Sao Paulo, a mesma virada do servidor) desde a
 * ultima sessao de leitura DESTE livro. `null` quando o leitor nunca
 * registrou uma sessao para ele — ausencia de dado nao e evidencia de
 * abandono, entao a tela nao deve tratar os dois casos como iguais.
 */
export function daysSinceLastSession(
  sessions: Pick<ReadingSession, 'book_id' | 'read_at'>[],
  bookId: string,
  now: Date = new Date(),
): number | null {
  const doLivro = sessions.filter((s) => s.book_id === bookId);
  if (doLivro.length === 0) return null;

  const maisRecente = doLivro.reduce(
    (max, s) => (s.read_at > max ? s.read_at : max),
    doLivro[0].read_at,
  );

  return diasEntre(todayInSaoPaulo(new Date(maisRecente)), todayInSaoPaulo(now));
}

/** Se alguma sessao (de qualquer livro) caiu no dia de hoje em Sao Paulo. */
export function readSessionToday(
  sessions: Pick<ReadingSession, 'read_at'>[],
  now: Date = new Date(),
): boolean {
  const hoje = todayInSaoPaulo(now);
  return sessions.some((s) => todayInSaoPaulo(new Date(s.read_at)) === hoje);
}

export type AssistantReason =
  | { kind: 'quiz'; chapterId: string; chapterNumber: number; questionCount: number }
  | { kind: 'streakRisk'; hoursLeft: number }
  | { kind: 'stale'; days: number };

/**
 * Qual e' o assunto do card do assistente, se houver algum. Prioridade fixa
 * (quiz pendente, depois sequencia em risco, depois livro parado): as tres
 * condicoes podem ser verdadeiras ao mesmo tempo, e o card mostra uma coisa
 * so. A ordem segue exatamente a ordem em que os tres critérios aparecem no
 * brief da tarefa.
 */
export function chooseAssistantReason({
  pendingQuiz,
  streak,
  readToday,
  staleDays,
  now = new Date(),
}: {
  pendingQuiz: { chapterId: string; chapterNumber: number; questionCount: number } | null;
  streak: number;
  readToday: boolean;
  staleDays: number | null;
  now?: Date;
}): AssistantReason | null {
  if (pendingQuiz) return { kind: 'quiz', ...pendingQuiz };

  const risco = streakRisk({ streak, readToday, now });
  if (risco.atRisk) return { kind: 'streakRisk', hoursLeft: risco.hoursLeft };

  if (staleDays !== null && staleDays >= 3) return { kind: 'stale', days: staleDays };

  return null;
}
