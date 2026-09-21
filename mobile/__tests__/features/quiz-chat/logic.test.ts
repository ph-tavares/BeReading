// Logica da conversa do quiz (spec 7.5, F5 Tarefa 2): a lista de mensagens sai
// de questions + results + answerTexts + currentIndex + evaluating, a mesma
// entrada que a rota do time ja mantem. Nada aqui muda a maquina de estados.
import { answeredXp, buildConversation, groundingCaption, scoreTagLabel } from '../../../src/features/quiz-chat/logic';
import { scoreLine } from '../../../src/assistant/lines';
import type { Question } from '../../../src/types/database';

const q = (type: Question['type'], text: string) => ({ type, question_text: text });

const PERGUNTAS = [
  q('comprehension', 'Onde Winston trabalha?'),
  q('comprehension', 'O que é o Grande Irmão?'),
  q('reflection', 'O que você faria no lugar dele?'),
];

const base = {
  questions: PERGUNTAS,
  results: {},
  answerTexts: {},
  currentIndex: 0,
  evaluating: false,
  pendingAnswer: '',
};

const kinds = (msgs: { kind: string }[]) => msgs.map((m) => m.kind);

describe('buildConversation', () => {
  it('inicio: so a primeira pergunta, em serifa e com rotulo', () => {
    const msgs = buildConversation(base);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({
      kind: 'assistant', text: 'Onde Winston trabalha?', serif: true, label: 'Compreensão',
    });
  });

  it('respondida com nota: bolha do leitor e devolutiva com tag de nota e XP', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: 72, feedback: 'Pegou o Ministério da Verdade.' } },
      answerTexts: { 0: 'No Ministério da Verdade' },
    });
    expect(kinds(msgs)).toEqual(['assistant', 'reader', 'feedback']);
    expect(msgs[1]).toMatchObject({ kind: 'reader', text: 'No Ministério da Verdade' });
    expect(msgs[2]).toMatchObject({ kind: 'feedback', text: 'Pegou o Ministério da Verdade.', tag: '72 · +14 XP' });
  });

  it('sem nota ainda (BER-42): devolutiva honesta e sem tag, nunca zero', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: null, feedback: 'qualquer' } },
      answerTexts: { 0: 'resposta' },
    });
    expect(msgs[2]).toEqual({ id: expect.any(String), kind: 'feedback', text: scoreLine(null), tag: null });
  });

  it('avaliando a atual: mostra o que o leitor mandou e o digitando', () => {
    const msgs = buildConversation({ ...base, evaluating: true, pendingAnswer: 'No ministério' });
    expect(kinds(msgs)).toEqual(['assistant', 'reader', 'typing']);
    expect(msgs[1]).toMatchObject({ kind: 'reader', text: 'No ministério' });
  });

  it('segunda pergunta: transicao antes dela, historico da primeira mantido', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: 90, feedback: 'Mandou bem.' } },
      answerTexts: { 0: 'x' },
      currentIndex: 1,
    });
    expect(kinds(msgs)).toEqual(['assistant', 'reader', 'feedback', 'assistant', 'assistant']);
    expect(msgs[3]).toMatchObject({ kind: 'assistant', text: 'Boa. Próxima.' });
    expect(msgs[4]).toMatchObject({ text: 'O que é o Grande Irmão?', serif: true });
  });

  it('ultima pergunta de reflexao: avisa que nao tem resposta certa e rotula Reflexão', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: 90, feedback: 'a' }, 1: { score: 80, feedback: 'b' } },
      answerTexts: { 0: 'x', 1: 'y' },
      currentIndex: 2,
    });
    const ultimas = msgs.slice(-2);
    expect(ultimas[0]).toMatchObject({ text: 'Agora a última, e essa não tem resposta certa.' });
    expect(ultimas[1]).toMatchObject({ label: 'Reflexão', serif: true });
  });

  it('quiz reaberto com tudo respondido (currentIndex 0): mostra o historico inteiro', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: 90, feedback: 'a' }, 1: { score: 80, feedback: 'b' }, 2: { score: 70, feedback: 'c' } },
      answerTexts: { 0: 'x', 1: 'y', 2: 'z' },
      currentIndex: 0,
    });
    expect(msgs.filter((m) => m.kind === 'reader')).toHaveLength(3);
  });

  it('ids sao unicos (chave de lista)', () => {
    const msgs = buildConversation({
      ...base,
      results: { 0: { score: 90, feedback: 'a' } },
      answerTexts: { 0: 'x' },
      currentIndex: 1,
      evaluating: true,
      pendingAnswer: 'y',
    });
    expect(new Set(msgs.map((m) => m.id)).size).toBe(msgs.length);
  });
});

describe('scoreTagLabel e answeredXp', () => {
  it('nota e XP da resposta (nota / 5, arredondado)', () => {
    expect(scoreTagLabel(72)).toBe('72 · +14 XP');
    expect(scoreTagLabel(5)).toBe('5 · +1 XP');
  });

  it('XP real soma so as avaliadas (BER-42)', () => {
    expect(answeredXp([{ score: 72, feedback: '' }, { score: null, feedback: '' }, { score: 90, feedback: '' }])).toBe(32);
    expect(answeredXp([])).toBe(0);
  });
});

// BER-59: a origem do conteúdo aparece; o conteúdo, nunca.
describe('groundingCaption', () => {
  const base = { fatos: 6, status: 'confirmed' as const };
  it('sem origem registrada, nada aparece', () => {
    expect(groundingCaption(null)).toBeNull();
    expect(groundingCaption(undefined)).toBeNull();
    expect(groundingCaption({ ...base, fontes: 0, dominios: [] })).toBeNull();
  });
  it('nomeia ate tres dominios e resume o resto', () => {
    expect(groundingCaption({ ...base, fontes: 1, dominios: ['wikipedia.org'] }))
      .toBe('Perguntas feitas a partir de fatos conferidos em 1 fonte: wikipedia.org.');
    expect(groundingCaption({ ...base, fontes: 5, dominios: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'] }))
      .toBe('Perguntas feitas a partir de fatos conferidos em 5 fontes independentes: a.com, b.com, c.com e mais 2.');
  });
  it('BER-60: conteudo da web diz que nao foi conferido; sem conteudo, diz que as perguntas sao sobre a leitura', () => {
    expect(groundingCaption({ fontes: 2, dominios: ['a.com', 'b.com'], fatos: 0, status: 'partial', origem: 'web' }))
      .toBe('Perguntas feitas a partir de resumos da web, sem conferência: a.com, b.com.');
    expect(groundingCaption({ fontes: 0, dominios: [], fatos: 0, status: 'partial', origem: 'leitura' }))
      .toBe('Ainda não temos o conteúdo deste capítulo. As perguntas são sobre a sua leitura.');
  });
});
