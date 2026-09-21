import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => false };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('expo-blur', () => ({ BlurView: () => null }));

import { ActionMenu } from '../../src/ui/ActionMenu';

const Icone = () => <Text>i</Text>;

function montar(visible = true) {
  const onClose = jest.fn();
  const sessao = jest.fn();
  const registrar = jest.fn();
  const tela = render(
    <ActionMenu
      visible={visible}
      title="O que vamos fazer?"
      onClose={onClose}
      actions={[
        { key: 'sessao', icon: Icone, title: 'Sessão de leitura', description: 'd', primary: true, onPress: sessao },
        { key: 'registrar', icon: Icone, title: 'Registrar leitura', description: 'd', onPress: registrar },
      ]}
    />,
  );
  return { tela, onClose, sessao, registrar };
}

// ADR 0016: o + abre as duas portas. Escolher uma fecha o menu e segue.
describe('ActionMenu', () => {
  it('fechado, nao desenha nada', () => {
    const { tela } = montar(false);
    expect(tela.queryByTestId('action-menu')).toBeNull();
  });

  it('escolher uma acao fecha o menu e executa so ela', () => {
    const { tela, onClose, sessao, registrar } = montar();
    fireEvent.press(tela.getByText('Registrar leitura'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(sessao).not.toHaveBeenCalled();
  });

  it('o X no lugar do + fecha sem executar nada', () => {
    const { tela, onClose, sessao, registrar } = montar();
    fireEvent.press(tela.getByTestId('action-menu-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sessao).not.toHaveBeenCalled();
    expect(registrar).not.toHaveBeenCalled();
  });
});
