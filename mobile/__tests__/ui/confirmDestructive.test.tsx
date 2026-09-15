import { Alert } from 'react-native';
import { confirmDestructive } from '../../src/ui/confirmDestructive';

afterEach(() => jest.restoreAllMocks());

describe('confirmDestructive', () => {
  it('abre o dialogo do sistema com cancelar e a acao destrutiva', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();
    confirmDestructive({
      title: 'Excluir sua conta?',
      message: 'Não dá pra desfazer.',
      confirmLabel: 'Excluir conta',
      onConfirm,
    });
    const [titulo, mensagem, botoes, opcoes] = alerta.mock.calls[0];
    expect(titulo).toBe('Excluir sua conta?');
    expect(mensagem).toBe('Não dá pra desfazer.');
    expect(botoes).toEqual([
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir conta', style: 'destructive', onPress: onConfirm },
    ]);
    expect(opcoes).toEqual({ cancelable: true });
  });

  it('so a acao destrutiva chama onConfirm', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();
    confirmDestructive({ title: 'T', message: 'M', confirmLabel: 'Apagar', onConfirm });
    const botoes = alerta.mock.calls[0][2]!;
    botoes[0].onPress?.();
    expect(onConfirm).not.toHaveBeenCalled();
    botoes[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('aceita rotulo proprio para cancelar', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    confirmDestructive({
      title: 'Cancelar assinatura?', message: 'M', confirmLabel: 'Cancelar assinatura',
      cancelLabel: 'Manter Premium', onConfirm: jest.fn(),
    });
    expect(alerta.mock.calls[0][2]![0]).toEqual({ text: 'Manter Premium', style: 'cancel' });
  });
});
