// BER-67: cobertura de render para o markup que antes vivia solto dentro de
// app/quiz/[chapterId].tsx (polling, still-generating, no-content, failed/vazio)
// sem nenhum teste. Um caso por estado real usado na tela do quiz.
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { QuizMessageScreen, QuizMessageIconBadge } from '../../src/components/QuizMessageScreen';

describe('QuizMessageIconBadge', () => {
  it('renderiza o ícone recebido', () => {
    const { getByText } = render(
      <QuizMessageIconBadge background="#A855F7" borderColor="#7E22CE">
        <Text>🔮</Text>
      </QuizMessageIconBadge>,
    );
    expect(getByText('🔮')).toBeTruthy();
  });
});

describe('QuizMessageScreen', () => {
  it('estado "polling": mostra título, descrição e o extra de progresso', () => {
    const { getByText } = render(
      <QuizMessageScreen
        paddingTop={80}
        paddingBottom={40}
        icon={<Text>✨</Text>}
        title="Preparando seu quiz"
        description={'A IA está gerando perguntas\nsobre o capítulo que você leu'}
        extra={<Text>Isso pode levar alguns instantes…</Text>}
      >
        <Text>Responder depois</Text>
      </QuizMessageScreen>,
    );

    expect(getByText('Preparando seu quiz')).toBeTruthy();
    expect(getByText('Isso pode levar alguns instantes…')).toBeTruthy();
    expect(getByText('Responder depois')).toBeTruthy();
  });

  it('estado "still-generating": as duas ações respondem ao toque', () => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    const { getByText } = render(
      <QuizMessageScreen
        paddingTop={80}
        paddingBottom={40}
        icon={<Text>✨</Text>}
        title="Seu quiz ainda está sendo preparado"
        description="Está demorando mais que o normal."
      >
        <Text onPress={onRetry}>Verificar de novo</Text>
        <Text onPress={onBack}>Responder depois</Text>
      </QuizMessageScreen>,
    );

    fireEvent.press(getByText('Verificar de novo'));
    fireEvent.press(getByText('Responder depois'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('estado "no-content": mostra o aviso de capítulo sem conteúdo e a ação de voltar', () => {
    const onBack = jest.fn();
    const { getByText } = render(
      <QuizMessageScreen
        paddingTop={80}
        paddingBottom={40}
        icon={<Text>📖</Text>}
        title="Ainda não temos este capítulo"
        description="Sem o conteúdo do capítulo, qualquer pergunta seria chute."
      >
        <Text onPress={onBack}>Voltar para o livro</Text>
      </QuizMessageScreen>,
    );

    fireEvent.press(getByText('Voltar para o livro'));
    expect(getByText('Ainda não temos este capítulo')).toBeTruthy();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('estado "failed"/vazio: aplica os tamanhos de título e descrição desse estado', () => {
    const { getByText } = render(
      <QuizMessageScreen
        justify="center"
        paddingTop={32}
        paddingBottom={32}
        icon={<Text>😔</Text>}
        title="Perguntas indisponíveis"
        titleSize={20}
        titleMarginBottom={8}
        description="Tente novamente mais tarde."
        descriptionSize={14}
        descriptionMarginBottom={32}
      >
        <Text>Voltar</Text>
      </QuizMessageScreen>,
    );

    const title = getByText('Perguntas indisponíveis');
    const description = getByText('Tente novamente mais tarde.');
    const titleStyle = Array.isArray(title.props.style) ? Object.assign({}, ...title.props.style) : title.props.style;
    const descriptionStyle = Array.isArray(description.props.style) ? Object.assign({}, ...description.props.style) : description.props.style;

    expect(titleStyle.fontSize).toBe(20);
    expect(descriptionStyle.fontSize).toBe(14);
  });
});
