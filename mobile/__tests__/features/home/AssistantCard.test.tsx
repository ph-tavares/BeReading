import { render, fireEvent } from '@testing-library/react-native';
import { AssistantCard } from '../../../src/features/home/AssistantCard';
import { ASSISTANT_NAME } from '../../../src/assistant/persona';

describe('AssistantCard', () => {
  it('mostra o nome do assistente e a fala recebida', () => {
    const { getByText } = render(<AssistantCard text="Você fechou o capítulo 3 e deixou 4 perguntas pra trás." />);
    expect(getByText(ASSISTANT_NAME)).toBeTruthy();
    expect(getByText('Você fechou o capítulo 3 e deixou 4 perguntas pra trás.')).toBeTruthy();
  });

  it('sem cta, nao ha botao', () => {
    const { queryByRole } = render(<AssistantCard text="Faltam 3h pra sua sequência zerar." />);
    expect(queryByRole('button')).toBeNull();
  });

  it('com cta, mostra o botao e chama onPress ao tocar', () => {
    const onPressCta = jest.fn();
    const { getByRole } = render(
      <AssistantCard text="fala" ctaLabel="Responder agora" onPressCta={onPressCta} />,
    );
    const botao = getByRole('button');
    fireEvent.press(botao);
    expect(onPressCta).toHaveBeenCalledTimes(1);
  });
});
