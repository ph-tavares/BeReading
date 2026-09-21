import { render, fireEvent } from '@testing-library/react-native';

// O mock oficial do Reanimated (jest.setup.ui.js) nao traz useReducedMotion,
// que o Button le. Mesma sobrescrita local de home.test.tsx.
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

import { QuizConversation } from '../../../src/features/quiz-chat/QuizConversation';
import { scoreLine } from '../../../src/assistant/lines';
import type { Question } from '../../../src/types/database';

const pergunta = (type: Question['type'], question_text: string) => ({ type, question_text });

const PERGUNTAS = [
  pergunta('comprehension', 'Onde Winston trabalha?'),
  pergunta('reflection', 'O que você faria no lugar dele?'),
];

function montar(over: Partial<React.ComponentProps<typeof QuizConversation>> = {}) {
  const props = {
    questions: PERGUNTAS,
    currentIndex: 0,
    results: {},
    answerTexts: {},
    answer: '',
    onChangeAnswer: jest.fn(),
    evaluating: false,
    onSubmit: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    ...over,
  };
  return { props, tela: render(<QuizConversation {...props} />) };
}

describe('QuizConversation (spec 7.5)', () => {
  it('mostra a pergunta atual com o rotulo e em que ponto do quiz o leitor esta', () => {
    const { tela } = montar();
    expect(tela.getByText('Onde Winston trabalha?')).toBeTruthy();
    expect(tela.getByText('Compreensão')).toBeTruthy();
    expect(tela.getByText('Pergunta 1 de 2')).toBeTruthy();
  });

  it('sem texto, Enviar fica desabilitado', () => {
    const { tela, props } = montar();
    const enviar = tela.getByRole('button', { name: 'Enviar' });
    expect(enviar.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(enviar);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('escrever repassa o texto, e com texto o Enviar dispara', () => {
    const { tela, props } = montar({ answer: 'No Ministério da Verdade' });
    fireEvent.changeText(tela.getByLabelText('Sua resposta'), 'abc');
    expect(props.onChangeAnswer).toHaveBeenCalledWith('abc');
    fireEvent.press(tela.getByRole('button', { name: 'Enviar' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('respondida: devolutiva, tag de nota e "Próxima", sem composer', () => {
    const { tela, props } = montar({
      results: { 0: { score: 72, feedback: 'Pegou o Ministério da Verdade.' } },
      answerTexts: { 0: 'No ministério' },
    });
    expect(tela.getByText('No ministério')).toBeTruthy();
    expect(tela.getByText('Pegou o Ministério da Verdade.')).toBeTruthy();
    expect(tela.getByText('72 · +14 XP')).toBeTruthy();
    expect(tela.queryByLabelText('Sua resposta')).toBeNull();
    fireEvent.press(tela.getByRole('button', { name: 'Próxima' }));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('ultima pergunta respondida: o botao leva ao resumo', () => {
    const { tela } = montar({
      currentIndex: 1,
      results: { 0: { score: 72, feedback: 'a' }, 1: { score: 80, feedback: 'b' } },
      answerTexts: { 0: 'x', 1: 'y' },
    });
    expect(tela.getByRole('button', { name: 'Ver resumo' })).toBeTruthy();
  });

  it('sem nota ainda (BER-42): diz que a nota chega depois, sem tag de zero', () => {
    const { tela } = montar({
      results: { 0: { score: null, feedback: 'qualquer' } },
      answerTexts: { 0: 'x' },
    });
    expect(tela.getByText(scoreLine(null))).toBeTruthy();
    expect(tela.queryByText(/· \+0 XP/)).toBeNull();
  });

  it('avaliando: mostra o digitando da Orelha e o Enviar em carregamento', () => {
    const { tela } = montar({ evaluating: true, answer: 'No ministério' });
    expect(tela.getByTestId('chat-typing')).toBeTruthy();
    expect(tela.getByRole('button', { name: 'Enviar' }).props.accessibilityState.busy).toBe(true);
  });

  it('mostra de onde veio o conteudo das perguntas quando o quiz tem conhecimento verificado (BER-59)', () => {
    const { tela } = montar({ grounding: { fontes: 2, dominios: ['uol.com.br', 'wikipedia.org'], fatos: 6, status: 'confirmed' } });
    expect(tela.getByTestId('quiz-grounding')).toHaveTextContent(
      'Perguntas feitas a partir de fatos conferidos em 2 fontes independentes: uol.com.br, wikipedia.org.',
    );
    expect(montar().tela.queryByTestId('quiz-grounding')).toBeNull();
  });

  it('voltar fecha o quiz', () => {
    const { tela, props } = montar();
    fireEvent.press(tela.getByRole('button', { name: 'Voltar' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
