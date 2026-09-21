import { StyleSheet, Text as RNText } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { X } from 'lucide-react-native';
import { Button } from '../../src/ui/Button';
import { IconButton } from '../../src/ui/IconButton';
import { color, MIN_TOUCH } from '../../src/theme/tokens';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

import * as Haptics from 'expo-haptics';

// Espiao em vez do icone real do lucide: evita o transform do pacote e
// deixa a cor recebida visivel como texto, pronta para asserir.
const IconSpy = ({ color: c }: { color: string }) => <RNText>{c}</RNText>;

describe('Button', () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  // fireEvent.press NAO dispara onPressIn (so onPress): sem este teste, o
  // handler inteiro de haptic podia ser apagado do Button que nenhuma suite
  // acusava.
  it('dispara haptic no pressIn', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Registrar</Button>);
    fireEvent(getByRole('button'), 'pressIn');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('nao dispara haptic no pressIn quando desabilitado', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Registrar</Button>);
    fireEvent(getByRole('button'), 'pressIn');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('chama onPress no toque', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress}>Registrar leitura</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('nao chama onPress quando desabilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} disabled>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('nao chama onPress durante o loading, para nao enviar duas vezes', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} loading>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia o estado desabilitado para o leitor de tela', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('anuncia busy durante o loading', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} loading>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });

  it('usa o proprio texto como label acessivel quando nenhum e dado', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Registrar leitura</Button>);
    expect(getByRole('button').props.accessibilityLabel).toBe('Registrar leitura');
  });

  // BER-120: acao primaria e' LEITURA, entao pinta com o jade. O ambar ficou
  // com a camada de jogo (XP, nivel, sequencia) — ver DESIGN.md secao 1. Este
  // teste e' o que impede o botao de voltar pro ambar por descuido de merge.
  it('o primario pinta com o jade de leitura, nao com o ambar de jogo', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    const fundo = StyleSheet.flatten(getByRole('button').props.style).backgroundColor;
    expect(fundo).toBe(color.brand);
    expect(fundo).not.toBe(color.accent);
  });

  it('o destrutivo usa o token de erro, nao o acento', () => {
    const { getByRole } = render(<Button variant="destructive" onPress={jest.fn()}>Sair</Button>);
    expect(StyleSheet.flatten(getByRole('button').props.style).backgroundColor).toBe(color.dangerSoft);
  });

  it('o desabilitado nao usa opacidade, para o texto seguir legivel', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Ir</Button>);
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.backgroundColor).toBe(color.surface2);
    expect(s.opacity).toBeUndefined();
  });

  it('respeita o alvo minimo de toque', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    expect(StyleSheet.flatten(getByRole('button').props.style).height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('o secundario usa a superficie 2 com borda visivel', () => {
    const { getByRole } = render(<Button variant="secondary" onPress={jest.fn()}>Ir</Button>);
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.backgroundColor).toBe(color.surface2);
    expect(s.borderColor).toBe(color.line2);
  });

  it('o ghost fica transparente e sem borda', () => {
    const { getByRole } = render(<Button variant="ghost" onPress={jest.fn()}>Ir</Button>);
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.backgroundColor).toBe('transparent');
    expect(s.borderColor).toBeUndefined();
  });

  it('o icone segue o mesmo tom do texto quando o botao esta desabilitado', () => {
    const { getByText } = render(
      <Button icon={IconSpy} disabled onPress={jest.fn()}>Registrar</Button>,
    );
    expect(getByText(color.text3)).toBeTruthy();
  });

  it('o icone do primario usa a tinta escura sobre o jade', () => {
    const { getByText } = render(
      <Button icon={IconSpy} onPress={jest.fn()}>Registrar</Button>,
    );
    expect(getByText(color.brandInk)).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('exige e expoe um label, porque icone sozinho nao se explica', () => {
    const { getByLabelText } = render(
      <IconButton icon={X} accessibilityLabel="Fechar o quiz" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Fechar o quiz')).toBeTruthy();
  });

  it('tem alvo de toque de ao menos 44 nos dois eixos', () => {
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Fechar" onPress={jest.fn()} />,
    );
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.width).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(s.height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('dispara onPress quando habilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Enviar" onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('nao dispara onPress quando desabilitado (composer sem texto, spec 7.5)', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Enviar" onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia o estado desabilitado para o leitor de tela', () => {
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Enviar" onPress={jest.fn()} disabled />,
    );
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });
});
