// As falas do assistente. Puras e testadas (BER-77).
//
// Nada aqui e gerado por IA: a unica fala vinda do modelo e a devolutiva que o
// evaluate-answer ja devolve. Isso mantem a voz previsivel, testavel e barata.
//
// Voz: 18 a 24 anos, direta, sem emoji e sem travessao. Ver DESIGN.md secao Voice.

// Sem variacao por periodo do dia: isso era invencao do plano, nao esta na
// spec (parag. 3.5), e o mockup aprovado pelo Breq rejeitou explicitamente o
// registro formal ("Boa noite, Guilherme") em favor do registro jovem unico
// ("E ai, Guilherme"). Por isso greeting nao depende mais da hora e nao
// importa hourInSaoPaulo.
export function greeting(): string {
  return 'E aí,';
}

/**
 * `readToday`: ja tem leitura registrada hoje. Sem ele, a fala mandava ler
 * hoje quem ja tinha lido, e prometia um numero que so vira amanha (R2, 15/09).
 */
export function streakLine(streak: number, readToday = false): string {
  if (streak <= 0) return 'Bora começar uma sequência? Uma página já conta.';
  const dias = streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
  if (readToday) return `${dias}. Hoje já conta, amanhã vira ${streak + 1}.`;
  return `${dias}. Lê hoje e vira ${streak + 1}.`;
}

export function streakRiskLine(hoursLeft: number): string {
  const verbo = hoursLeft === 1 ? 'Falta' : 'Faltam';
  return `${verbo} ${hoursLeft}h pra sua sequência zerar. Uma página já conta.`;
}

export function chapterClosedTitle(chapterNumbers: number[]): string {
  if (chapterNumbers.length === 1) return `Capítulo ${chapterNumbers[0]}, fechado.`;
  return `${chapterNumbers.length} capítulos, fechados.`;
}

/**
 * O titulo quando nao da pra saber o numero do capitulo (F4-15: a consulta dos
 * capitulos falhou). Nao inventa numero; a contagem vem dos ids que o proprio
 * registro devolveu.
 */
export function chapterClosedTitleWithoutNumber(count: number): string {
  if (count <= 1) return 'Capítulo fechado.';
  return `${count} capítulos, fechados.`;
}

/** O convite pro quiz logo abaixo do titulo de capitulo fechado (spec 7.3, F4-16). */
export function quizInviteLine(): string {
  return 'Bora ver o que ficou?';
}

export function levelUpLine(level: number, title: string): string {
  return `Nível ${level}. Agora você é ${title}.`;
}

/** A nota ja aparece como numero na tela; aqui vai so a leitura humana dela. */
export function scoreLine(score: number | null): string {
  if (score === null) return 'Salvei sua resposta. A nota chega quando eu terminar de avaliar.';
  if (score >= 85) return 'Mandou bem.';
  if (score >= 70) return 'Boa. Faltou pouco pro ponto principal.';
  if (score >= 40) return 'Quase. Olha esse detalhe que passou.';
  // Abaixo de 40, chamar de "quase" seria mentira, e a devolutiva honesta e
  // o principio do produto.
  return 'Essa não foi. Vale reler o trecho antes de seguir.';
}

export type QuizStateKey = 'polling' | 'still-generating' | 'no-content' | 'failed' | 'quota';

/**
 * Os estados da tela de quiz, ditos pelo assistente. A maquina de estados nao
 * muda (BER-40, BER-66); muda quem conta o que esta acontecendo.
 */
export function quizStateLine(
  state: QuizStateKey,
  /** `null` quando a tela ainda nao sabe o numero: a fala nao inventa um. */
  chapterNumber: number | null,
): { text: string; cta?: string } {
  switch (state) {
    case 'polling':
      return {
        text: chapterNumber === null
          ? 'Tô relendo o capítulo pra montar suas perguntas.'
          : `Tô relendo o capítulo ${chapterNumber} pra montar suas perguntas.`,
      };
    case 'still-generating':
      return {
        text: 'Tá demorando mais que o normal. Sua leitura já tá salva, e eu te aviso na Hoje quando ficar pronto.',
        cta: 'Verificar de novo',
      };
    case 'no-content':
      // BER-66: falta conteudo, nao e falha de IA. Nao oferecer re-tentar, porque
      // re-tentar sabidamente nao resolve.
      return {
        text: 'Ainda não tenho esse capítulo aqui. Perguntar sem ter lido seria chute, e eu não chuto. Sua leitura já tá salva.',
        cta: 'Voltar pro livro',
      };
    case 'failed':
      return { text: 'Deu ruim do meu lado. Tenta de novo daqui a pouco.', cta: 'Tentar de novo' };
    case 'quota':
      // BER-58: nao e erro. A data de volta e o convite vem de paywallCopy, na tela.
      return { text: 'Seus quizzes do mês acabaram. Sua leitura continua valendo.', cta: 'Conhecer o Premium' };
  }
}

/**
 * A fala entre uma pergunta e a proxima na conversa do quiz (spec 7.5). Antes
 * da reflexao, avisa que nao existe resposta certa, para o leitor nao travar
 * procurando a "correta".
 */
export function quizTransitionLine(nextType: 'comprehension' | 'reflection', isLast: boolean): string {
  if (nextType === 'reflection') {
    return isLast
      ? 'Agora a última, e essa não tem resposta certa.'
      : 'Agora uma de reflexão. Essa não tem resposta certa.';
  }
  return 'Boa. Próxima.';
}

/** Titulo do resumo do quiz (spec 7.6). Sem o numero do capitulo, nao inventa um. */
export function chapterUnderstoodTitle(chapterNumber: number | null): string {
  return chapterNumber === null ? 'Quiz fechado.' : `Capítulo ${chapterNumber}, entendido.`;
}

export function pendingQuizLine(chapterNumber: number, count: number): string {
  const perguntas = count === 1 ? '1 pergunta' : `${count} perguntas`;
  return `Você fechou o capítulo ${chapterNumber} e deixou ${perguntas} pra trás.`;
}

/**
 * O livro em leitura ficou `days` dias sem sessão nova. Terceiro gatilho do
 * card da Orelha na Hoje (quiz pendente e sequência em risco vêm antes na
 * prioridade), sem entrada própria na tabela de voz do DESIGN.md ainda —
 * segue o mesmo padrão de "uma página já X" de `streakLine`/`streakRiskLine`.
 */
export function staleBookLine(days: number): string {
  const tempo = days === 1 ? '1 dia' : `${days} dias`;
  return `Faz ${tempo} que você não abre o livro. Uma página já reata.`;
}
