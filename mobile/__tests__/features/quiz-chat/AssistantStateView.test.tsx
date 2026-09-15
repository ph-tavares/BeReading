import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

import { AssistantStateView } from '../../../src/features/quiz-chat/AssistantStateView';
import { quizStateLine } from '../../../src/assistant/lines';

function montar(state: React.ComponentProps<typeof AssistantStateView>['state'], chapterNumber: number | null = 3) {
  const onPrimary = jest.fn();
  const onBack = jest.fn();
  const tela = render(
    <AssistantStateView state={state} chapterNumber={chapterNumber} detail="Detalhe do estado." onPrimary={onPrimary} onBack={onBack} />,
  );
  return { tela, onPrimary, onBack };
}

describe('AssistantStateView (spec 7.5, estados como fala)', () => {
  it('a Orelha aparece e a fala vem de quizStateLine', () => {
    const { tela } = montar('failed');
    // O Glyph e decorativo (escondido do leitor de tela de proposito): a busca precisa incluir os escondidos.
    expect(tela.getByTestId('glyph', { includeHiddenElements: true })).toBeTruthy();
    expect(tela.getByText(quizStateLine('failed', 3).text)).toBeTruthy();
    expect(tela.getByText('Detalhe do estado.')).toBeTruthy();
  });

  it('polling: diz o capitulo e so oferece responder depois', () => {
    const { tela, onBack, onPrimary } = montar('polling');
    expect(tela.getByText('Tô relendo o capítulo 3 pra montar suas perguntas.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Responder depois' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(tela.getAllByRole('button')).toHaveLength(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it('polling sem numero do capitulo: nao inventa um', () => {
    const { tela } = montar('polling', null);
    expect(tela.getByText('Tô relendo o capítulo pra montar suas perguntas.')).toBeTruthy();
  });

  it('still-generating: verificar de novo e responder depois', () => {
    const { tela, onBack, onPrimary } = montar('still-generating');
    fireEvent.press(tela.getByRole('button', { name: 'Verificar de novo' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.press(tela.getByRole('button', { name: 'Responder depois' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('no-content (BER-66): so volta pro livro, sem tentar de novo', () => {
    const { tela, onBack } = montar('no-content');
    fireEvent.press(tela.getByRole('button', { name: 'Voltar pro livro' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(tela.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('failed: tentar de novo e voltar', () => {
    const { tela, onBack, onPrimary } = montar('failed');
    fireEvent.press(tela.getByRole('button', { name: 'Tentar de novo' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.press(tela.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('quota (BER-58): convite ao Premium e voltar, sem cara de erro', () => {
    const { tela, onBack, onPrimary } = montar('quota');
    expect(tela.getByText(quizStateLine('quota', 3).text)).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Conhecer o Premium' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.press(tela.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
