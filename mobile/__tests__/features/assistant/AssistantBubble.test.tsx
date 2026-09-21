// BER-100: a bolinha do assistente, a unica superficie flutuante do app.
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

import { AssistantBubble } from '../../../src/features/assistant/AssistantBubble';
import { TAB_BAR_HEIGHT } from '../../../src/ui/TabBar';

describe('AssistantBubble', () => {
  it('diz o que faz para quem usa leitor de tela', () => {
    const { getByLabelText } = render(<AssistantBubble onPress={jest.fn()} />);
    const bolinha = getByLabelText('Perguntar sobre uma página');
    expect(bolinha).toBeTruthy();
    expect(bolinha.props.accessibilityHint).toMatch(/câmera/);
  });

  it('aciona ao toque', () => {
    const aoTocar = jest.fn();
    const { getByLabelText } = render(<AssistantBubble onPress={aoTocar} />);
    fireEvent.press(getByLabelText('Perguntar sobre uma página'));
    expect(aoTocar).toHaveBeenCalled();
  });

  // Sem livro em leitura nao ha pagina para fotografar.
  it('some quando nao ha o que perguntar', () => {
    const { queryByLabelText } = render(<AssistantBubble onPress={jest.fn()} visible={false} />);
    expect(queryByLabelText('Perguntar sobre uma página')).toBeNull();
  });

  // O artboard B1 poe a bolinha ACIMA da barra de abas, nao em cima dela.
  it('fica acima da barra de abas, nunca colada nela', () => {
    const { UNSAFE_root } = render(<AssistantBubble onPress={jest.fn()} />);
    const ancora = UNSAFE_root.findAll(
      (no: { props?: Record<string, unknown> }) =>
        no.props?.pointerEvents === 'box-none' && Boolean(no.props?.style),
    )[0];
    const estilo: Record<string, number | string> = [ancora.props.style]
      .flat()
      .reduce((acc, s) => ({ ...acc, ...(s ?? {}) }), {});
    expect(estilo.position).toBe('absolute');
    expect(estilo.bottom).toBeGreaterThan(TAB_BAR_HEIGHT);
    // Canto esquerdo: a direita e onde passa a mao que segura o livro, e onde
    // fica o CTA da tela.
    expect(estilo.alignItems).toBe('flex-start');
  });
});
