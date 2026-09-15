import { render, fireEvent } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';
import { Sheet } from '../../src/ui/Sheet';

describe('Sheet', () => {
  it('visivel: mostra o conteudo', () => {
    const { getByText } = render(
      <Sheet visible onDismiss={jest.fn()} accessibilityLabel="Convite"><Text>Conteúdo</Text></Sheet>,
    );
    expect(getByText('Conteúdo')).toBeTruthy();
  });

  it('invisivel: nao mostra nada', () => {
    const { queryByText } = render(
      <Sheet visible={false} onDismiss={jest.fn()} accessibilityLabel="Convite"><Text>Conteúdo</Text></Sheet>,
    );
    expect(queryByText('Conteúdo')).toBeNull();
  });

  it('tocar fora (scrim) fecha, e o scrim se anuncia como botao de fechar', () => {
    const onDismiss = jest.fn();
    const { getByRole } = render(
      <Sheet visible onDismiss={onDismiss} accessibilityLabel="Convite"><Text>Conteúdo</Text></Sheet>,
    );
    fireEvent.press(getByRole('button', { name: 'Fechar' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('o voltar do Android fecha (onRequestClose)', () => {
    const onDismiss = jest.fn();
    const { UNSAFE_getByType } = render(
      <Sheet visible onDismiss={onDismiss} accessibilityLabel="Convite"><Text>Conteúdo</Text></Sheet>,
    );
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
