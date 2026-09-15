import * as lines from '../../src/assistant/lines';
import {
  greeting, streakLine, streakRiskLine, chapterClosedTitle,
  levelUpLine, scoreLine, quizStateLine, pendingQuizLine, staleBookLine,
  chapterClosedTitleWithoutNumber, quizInviteLine, quizTransitionLine, chapterUnderstoodTitle,
} from '../../src/assistant/lines';
import { ASSISTANT_NAME } from '../../src/assistant/persona';

/** Toda copy do app passa por aqui: nada de emoji, nada de travessao. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

const TODAS = [
  greeting(),
  streakLine(4), streakLine(0), streakLine(1), streakLine(4, true),
  streakRiskLine(3),
  chapterClosedTitle([4]), chapterClosedTitle([4, 5]),
  chapterClosedTitleWithoutNumber(1), chapterClosedTitleWithoutNumber(3),
  quizInviteLine(),
  levelUpLine(5, 'Maratonista'),
  scoreLine(92), scoreLine(60), scoreLine(10), scoreLine(null),
  pendingQuizLine(3, 4), pendingQuizLine(3, 1),
  staleBookLine(3), staleBookLine(1),
  quizStateLine('polling', 5).text,
  quizStateLine('still-generating', 5).text,
  quizStateLine('no-content', 5).text,
  quizStateLine('failed', 5).text,
  quizStateLine('quota', 5).text,
  quizTransitionLine('comprehension', false), quizTransitionLine('reflection', true),
  quizTransitionLine('reflection', false),
  chapterUnderstoodTitle(4), chapterUnderstoodTitle(null),
];

// Se este teste falhar, uma fala nova foi exportada e falta pôr uma amostra
// dela em TODAS — senão ela escapa do contrato de voz sem ninguém notar.
it('TODAS cobre toda fala exportada por lines.ts', () => {
  expect(Object.keys(lines).sort()).toEqual([
    'chapterClosedTitle', 'chapterClosedTitleWithoutNumber', 'chapterUnderstoodTitle', 'greeting',
    'levelUpLine', 'pendingQuizLine', 'quizInviteLine', 'quizTransitionLine',
    'quizStateLine', 'scoreLine', 'staleBookLine', 'streakLine', 'streakRiskLine',
  ].sort());
});

describe('contrato de voz', () => {
  it.each(TODAS)('a fala %p nao tem emoji', (texto) => {
    expect(EMOJI.test(texto)).toBe(false);
  });

  it.each(TODAS)('a fala %p nao tem travessao', (texto) => {
    expect(TRAVESSAO.test(texto)).toBe(false);
  });

  it.each(TODAS)('a fala %p nao fica vazia', (texto) => {
    expect(texto.trim().length).toBeGreaterThan(0);
  });
});

describe('greeting', () => {
  it('cumprimenta no registro jovem, sem variar por hora do dia', () => {
    expect(greeting()).toBe('E aí,');
  });
});

describe('streakLine', () => {
  it('convida quem tem sequencia a continuar, com o numero certo', () => {
    expect(streakLine(4)).toBe('4 dias seguidos. Lê hoje e vira 5.');
  });

  it('trata o singular', () => {
    expect(streakLine(1)).toBe('1 dia seguido. Lê hoje e vira 2.');
  });

  it('sem sequencia, convida a comecar sem cobrar', () => {
    expect(streakLine(0)).toBe('Bora começar uma sequência? Uma página já conta.');
  });

  it('ja leu hoje: nao manda ler de novo, e o numero novo e de amanha (R2, 15/09)', () => {
    expect(streakLine(1, true)).toBe('1 dia seguido. Hoje já conta, amanhã vira 2.');
    expect(streakLine(4, true)).toBe('4 dias seguidos. Hoje já conta, amanhã vira 5.');
  });
});

describe('falas do quiz em conversa e do resumo (F5)', () => {
  it('quota: a cota do mes acabou, sem tratar como erro', () => {
    expect(quizStateLine('quota', 3)).toEqual({
      text: 'Seus quizzes do mês acabaram. Sua leitura continua valendo.',
      cta: 'Conhecer o Premium',
    });
  });

  it('polling sem numero do capitulo: nao inventa "capitulo 0"', () => {
    expect(quizStateLine('polling', null).text).toBe('Tô relendo o capítulo pra montar suas perguntas.');
  });

  it('transicao entre perguntas de compreensao', () => {
    expect(quizTransitionLine('comprehension', false)).toBe('Boa. Próxima.');
  });

  it('antes da reflexao, avisa que nao tem resposta certa', () => {
    expect(quizTransitionLine('reflection', true)).toBe('Agora a última, e essa não tem resposta certa.');
    expect(quizTransitionLine('reflection', false)).toBe('Agora uma de reflexão. Essa não tem resposta certa.');
  });

  it('titulo do resumo com e sem numero do capitulo', () => {
    expect(chapterUnderstoodTitle(4)).toBe('Capítulo 4, entendido.');
    expect(chapterUnderstoodTitle(null)).toBe('Quiz fechado.');
  });
});

describe('streakRiskLine', () => {
  it('diz quantas horas faltam e que pouco ja resolve', () => {
    expect(streakRiskLine(3)).toBe('Faltam 3h pra sua sequência zerar. Uma página já conta.');
  });

  it('na ultima hora, fala no singular', () => {
    expect(streakRiskLine(1)).toBe('Falta 1h pra sua sequência zerar. Uma página já conta.');
  });
});

describe('chapterClosedTitle', () => {
  it('nomeia o capitulo quando e um so', () => {
    expect(chapterClosedTitle([4])).toBe('Capítulo 4, fechado.');
  });

  it('conta quando sao varios', () => {
    expect(chapterClosedTitle([4, 5])).toBe('2 capítulos, fechados.');
  });
});

// F4-15: a consulta dos capitulos falhou. O titulo nao inventa numero de
// capitulo; a contagem vem dos ids que o servidor devolveu no registro.
describe('chapterClosedTitleWithoutNumber', () => {
  it('um capitulo: sem numero nenhum', () => {
    expect(chapterClosedTitleWithoutNumber(1)).toBe('Capítulo fechado.');
  });

  it('mais de um: a contagem, no mesmo registro do titulo com numero', () => {
    expect(chapterClosedTitleWithoutNumber(3)).toBe('3 capítulos, fechados.');
  });

  it('sem id nenhum, cai no singular sem numero em vez de "0 capítulos"', () => {
    expect(chapterClosedTitleWithoutNumber(0)).toBe('Capítulo fechado.');
  });
});

// F4-16: e fala do assistente (spec 7.3), entao mora aqui e nao na tela.
describe('quizInviteLine', () => {
  it('convida pro quiz com a fala da spec', () => {
    expect(quizInviteLine()).toBe('Bora ver o que ficou?');
  });
});

describe('levelUpLine', () => {
  it('anuncia o nivel e o titulo novo', () => {
    expect(levelUpLine(5, 'Maratonista')).toBe('Nível 5. Agora você é Maratonista.');
  });
});

describe('scoreLine', () => {
  it('elogia nota alta sem exagero', () => {
    expect(scoreLine(92)).toBe('Mandou bem.');
  });

  it('nota baixa aponta o caminho em vez de consolar', () => {
    expect(scoreLine(50)).toBe('Quase. Olha esse detalhe que passou.');
  });

  it('faixa 70 a 84 reconhece o esforco, sem chamar de "mandou bem"', () => {
    expect(scoreLine(75)).toBe('Boa. Faltou pouco pro ponto principal.');
  });

  it('nota muito baixa nao chama de "quase", porque seria mentira', () => {
    expect(scoreLine(10)).toBe('Essa não foi. Vale reler o trecho antes de seguir.');
  });

  it('sem nota, diz o que esta acontecendo (BER-42)', () => {
    expect(scoreLine(null)).toBe('Salvei sua resposta. A nota chega quando eu terminar de avaliar.');
  });
});

describe('quizStateLine', () => {
  it('no polling, explica o que esta fazendo e cita o capitulo', () => {
    expect(quizStateLine('polling', 5).text).toContain('capítulo 5');
  });

  it('no no-content, assume o limite e nao oferece re-tentar', () => {
    const r = quizStateLine('no-content', 5);
    expect(r.text).toContain('chute');
    expect(r.cta).toBe('Voltar pro livro');
  });

  it('no still-generating, garante que a leitura esta salva e oferece verificar', () => {
    const r = quizStateLine('still-generating', 5);
    expect(r.text).toContain('salva');
    expect(r.cta).toBe('Verificar de novo');
  });

  it('no failed, assume a culpa em vez de mandar o leitor se virar', () => {
    expect(quizStateLine('failed', 5).text).toContain('meu lado');
  });
});

describe('pendingQuizLine', () => {
  it('lembra do quiz parado, com plural', () => {
    expect(pendingQuizLine(3, 4)).toBe('Você fechou o capítulo 3 e deixou 4 perguntas pra trás.');
  });

  it('trata o singular', () => {
    expect(pendingQuizLine(3, 1)).toBe('Você fechou o capítulo 3 e deixou 1 pergunta pra trás.');
  });
});

describe('staleBookLine', () => {
  it('lembra do livro parado, com plural', () => {
    expect(staleBookLine(3)).toBe('Faz 3 dias que você não abre o livro. Uma página já reata.');
  });

  it('trata o singular', () => {
    expect(staleBookLine(1)).toBe('Faz 1 dia que você não abre o livro. Uma página já reata.');
  });
});

describe('persona', () => {
  it('o nome vive num lugar so, porque ainda e provisorio', () => {
    expect(ASSISTANT_NAME.length).toBeGreaterThan(0);
  });
});
