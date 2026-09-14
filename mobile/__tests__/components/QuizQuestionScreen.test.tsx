// BER-67: cobertura de render para o fluxo pergunta/resposta/resultado que antes
// vivia dentro de app/quiz/[chapterId].tsx sem nenhum teste de UI.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('react-native-shadow-2', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Shadow: ({ children, ...rest }: any) => React.createElement(View, rest, children),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { render, fireEvent } from '@testing-library/react-native';
import { QuizQuestionScreen } from '../../src/components/QuizQuestionScreen';
import type { Question } from '../../src/types/database';

const comprehensionQuestion: Question = {
  id: 'q1',
  chapter_id: 'ch1',
  type: 'comprehension',
  question_text: 'O que motivou a decisão do personagem principal?',
  generated_at: '2026-01-01T00:00:00.000Z',
};

const reflectionQuestion: Question = {
  ...comprehensionQuestion,
  id: 'q2',
  type: 'reflection',
};

describe('QuizQuestionScreen', () => {
  it('mostra o texto da pergunta e a categoria "Compreensão"', () => {
    const { getByText } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={3}
        answer=""
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={null}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(getByText('O que motivou a decisão do personagem principal?')).toBeTruthy();
    expect(getByText('Compreensão')).toBeTruthy();
    expect(getByText('1/3')).toBeTruthy();
  });

  it('categoriza perguntas do tipo reflection como "Reflexão"', () => {
    const { getByText } = render(
      <QuizQuestionScreen
        question={reflectionQuestion}
        currentIndex={1}
        totalQuestions={2}
        answer=""
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={null}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(getByText('Reflexão')).toBeTruthy();
  });

  it('não avaliado: desabilita o envio sem resposta e envia com resposta preenchida', () => {
    const onSubmit = jest.fn();
    const { getByText, rerender } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={1}
        answer=""
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={null}
        onBack={jest.fn()}
        onSubmit={onSubmit}
        onNext={jest.fn()}
      />,
    );

    fireEvent.press(getByText('Enviar resposta'));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={1}
        answer="porque sim"
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={null}
        onBack={jest.fn()}
        onSubmit={onSubmit}
        onNext={jest.fn()}
      />,
    );

    fireEvent.press(getByText('Enviar resposta'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('avaliação pendente (score null): mostra "Avaliação em processamento", não "0/100" (BER-42)', () => {
    const { getByText, queryByText } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={1}
        answer="minha resposta"
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={{ score: null, feedback: '' }}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(getByText('Avaliação em processamento')).toBeTruthy();
    expect(queryByText('0')).toBeNull();
  });

  it('avaliado com nota: mostra o score, o feedback e avança ao pressionar "Próxima"', () => {
    const onNext = jest.fn();
    const { getByText } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={2}
        answer="minha resposta"
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={{ score: 92, feedback: 'Ótima leitura do trecho.' }}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        onNext={onNext}
      />,
    );

    expect(getByText('92')).toBeTruthy();
    expect(getByText('PERFEITO')).toBeTruthy();
    expect(getByText('Ótima leitura do trecho.')).toBeTruthy();

    fireEvent.press(getByText('Próxima'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('última pergunta avaliada: o botão de avançar mostra "Ver recompensas"', () => {
    const { getByText } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={1}
        totalQuestions={2}
        answer="minha resposta"
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={{ score: 70, feedback: 'Bom.' }}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    expect(getByText('Ver recompensas')).toBeTruthy();
  });

  it('botão de voltar (X) chama onBack', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(
      <QuizQuestionScreen
        question={comprehensionQuestion}
        currentIndex={0}
        totalQuestions={1}
        answer=""
        onChangeAnswer={jest.fn()}
        evaluating={false}
        result={null}
        onBack={onBack}
        onSubmit={jest.fn()}
        onNext={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('quiz-question-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
