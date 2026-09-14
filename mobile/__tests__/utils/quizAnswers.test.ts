import {
  PENDING_FEEDBACK,
  resultFromAnswer,
  resultsFromExistingAnswers,
} from '../../src/utils/quizAnswers';

// BER-48: a resposta é imutável. Ao abrir um quiz já começado, a tela mostra o que
// o leitor respondeu e a avaliação que recebeu, e começa na primeira pergunta aberta.

const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];

const answer = (
  question_id: string,
  extra: Partial<{
    answer_text: string;
    evaluation_status: 'pending' | 'completed' | 'failed';
    comprehension_score: number | null;
    ai_feedback: string | null;
  }> = {},
) => ({
  question_id,
  answer_text: `resposta de ${question_id}`,
  evaluation_status: 'completed' as const,
  comprehension_score: 80,
  ai_feedback: 'Bom.',
  ...extra,
});

describe('resultFromAnswer', () => {
  it('resposta avaliada vira a nota e o feedback que já existem', () => {
    expect(resultFromAnswer(answer('q1', { comprehension_score: 92, ai_feedback: 'Ótimo.' })))
      .toEqual({ score: 92, feedback: 'Ótimo.' });
  });

  it('resposta sem nota não vira zero (BER-42)', () => {
    expect(resultFromAnswer(answer('q1', { evaluation_status: 'pending', comprehension_score: null, ai_feedback: null })))
      .toEqual({ score: null, feedback: PENDING_FEEDBACK });
    expect(resultFromAnswer(answer('q1', { evaluation_status: 'failed', comprehension_score: null, ai_feedback: null })))
      .toEqual({ score: null, feedback: PENDING_FEEDBACK });
  });
});

describe('resultsFromExistingAnswers', () => {
  it('sem resposta nenhuma, começa na primeira pergunta', () => {
    expect(resultsFromExistingAnswers(questions, [])).toEqual({
      results: {},
      answerTexts: {},
      startIndex: 0,
    });
  });

  it('com as duas primeiras respondidas, começa na terceira', () => {
    const out = resultsFromExistingAnswers(questions, [answer('q1'), answer('q2')]);
    expect(out.startIndex).toBe(2);
    expect(Object.keys(out.results)).toEqual(['0', '1']);
    expect(out.answerTexts[1]).toBe('resposta de q2');
  });

  it('casa resposta com pergunta pelo id, não pela ordem', () => {
    const out = resultsFromExistingAnswers(questions, [answer('q3', { comprehension_score: 55 })]);
    expect(out.results[2]).toEqual({ score: 55, feedback: 'Bom.' });
    expect(out.startIndex).toBe(0);
  });

  it('com tudo respondido, abre na primeira para revisar', () => {
    const out = resultsFromExistingAnswers(questions, questions.map((q) => answer(q.id)));
    expect(out.startIndex).toBe(0);
    expect(Object.keys(out.results)).toHaveLength(3);
  });

  it('o texto pendente é o mesmo que o servidor devolve', () => {
    expect(PENDING_FEEDBACK).toBe('Resposta recebida! A avaliação ficará disponível em breve.');
  });
});
