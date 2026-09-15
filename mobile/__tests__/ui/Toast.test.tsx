import { render, fireEvent, act, within } from '@testing-library/react-native';
import { Platform, Pressable, StyleSheet, Text as RNText } from 'react-native';
import { ToastProvider, useToast } from '../../src/ui/Toast';
import { color, motion } from '../../src/theme/tokens';

// F4-11: no iOS o toast passa pelo FullWindowOverlay do react-native-screens.
// O mock troca o componente nativo por uma View que conta quantas vezes montou
// e repassa as props, para o teste enxergar por onde o toast passa. Fica aqui,
// na camada de teste: o Toast.tsx nao tem ramo nenhum que exista so para o
// Jest (ADR 0010, corolario).
const mockOverlay = { montagens: 0 };
jest.mock('react-native-screens', () => {
  const React = require('react');
  const { View } = require('react-native');
  function FullWindowOverlay({ children, ...props }: { children?: React.ReactNode; [prop: string]: unknown }) {
    React.useEffect(() => {
      mockOverlay.montagens += 1;
    }, []);
    return React.createElement(View, { testID: 'full-window-overlay', ...props }, children);
  }
  return { FullWindowOverlay };
});

function Tela({ opts }: { opts: any }) {
  const { show } = useToast();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="disparar" onPress={() => show(opts)}>
      <RNText>disparar</RNText>
    </Pressable>
  );
}

const montar = (opts: any) =>
  render(<ToastProvider><Tela opts={opts} /></ToastProvider>);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('nao aparece antes de alguem pedir', () => {
    const { queryByText } = montar({ message: '28 páginas registradas' });
    expect(queryByText('28 páginas registradas')).toBeNull();
  });

  it('mostra a mensagem quando pedido', () => {
    const { getByLabelText, getByText } = montar({ message: '28 páginas registradas' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('28 páginas registradas')).toBeTruthy();
  });

  it('mostra o detalhe junto', () => {
    const { getByLabelText, getByText } = montar({
      message: '28 páginas registradas', detail: 'mais 140 XP · 5 dias seguidos',
    });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('mais 140 XP · 5 dias seguidos')).toBeTruthy();
  });

  it('some sozinho, sem exigir toque', () => {
    const { getByLabelText, queryByText } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(queryByText('Salvo')).toBeNull();
  });

  it('dispara a acao e fecha', () => {
    const onAction = jest.fn();
    const { getByLabelText, queryByText } = montar({
      message: 'Não deu para registrar', actionLabel: 'Tentar', onAction,
    });
    fireEvent.press(getByLabelText('disparar'));
    fireEvent.press(getByLabelText('Tentar'));
    expect(onAction).toHaveBeenCalled();
    expect(queryByText('Não deu para registrar')).toBeNull();
  });

  it('o toast novo substitui o anterior, em vez de empilhar', () => {
    const { getByLabelText, queryByText, rerender } = montar({ message: 'Primeiro' });
    fireEvent.press(getByLabelText('disparar'));
    rerender(<ToastProvider><Tela opts={{ message: 'Segundo' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    expect(queryByText('Primeiro')).toBeNull();
    expect(queryByText('Segundo')).toBeTruthy();
  });

  it('o segundo toast nao some cedo por causa do timer do primeiro (limpar() dentro do show())', () => {
    // Sem o limpar() no comeco do show(), o timer do "Primeiro" (criado em
    // t=0, para disparar em t=4000) continua vivo. Aqui ele mostra o
    // "Segundo" em t=2000 (novo timer previsto para t=6000) e avanca so ate
    // t=4000: se o timer velho nao foi cancelado, ele dispara setToast(null)
    // e apaga o "Segundo" dois segundos antes da hora.
    const { getByLabelText, queryByText, rerender } = montar({ message: 'Primeiro' });
    fireEvent.press(getByLabelText('disparar'));
    act(() => { jest.advanceTimersByTime(2000); });
    rerender(<ToastProvider><Tela opts={{ message: 'Segundo' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(queryByText('Segundo')).toBeTruthy();
  });

  it('se anuncia como alerta para o leitor de tela', () => {
    const { getByLabelText, getByRole } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByRole('alert')).toBeTruthy();
  });

  it('usa live region "polite", sem a qual o TalkBack nao anuncia o alert sozinho', () => {
    const { getByLabelText, getByRole } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
  });

  it('limpa o timer pendente quando desmonta, para nao disparar contra arvore morta', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const { getByLabelText, unmount } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    clearSpy.mockClear();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('estoura sem ToastProvider por cima, para nao falhar em silencio', () => {
    // React loga o erro do throw no console durante o render: silencia so
    // aqui, para nao poluir a saida do teste com um erro esperado.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function SemProvider() {
      useToast();
      return null;
    }
    expect(() => render(<SemProvider />)).toThrow(
      'useToast precisa de um ToastProvider acima na arvore',
    );
    errorSpy.mockRestore();
  });

  it('pinta o indicador com a cor do tom pedido, positivo e perigo nao podem parecer iguais', () => {
    const { getByLabelText, getByTestId, rerender } = montar({ message: 'Ok', tone: 'positive' });
    fireEvent.press(getByLabelText('disparar'));
    const positivo = StyleSheet.flatten(getByTestId('toast-indicator').props.style);
    expect(positivo.backgroundColor).toBe(color.positive);

    rerender(<ToastProvider><Tela opts={{ message: 'Falhou', tone: 'danger' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    const perigo = StyleSheet.flatten(getByTestId('toast-indicator').props.style);
    expect(perigo.backgroundColor).toBe(color.danger);
    expect(perigo.backgroundColor).not.toBe(positivo.backgroundColor);
  });
});

// F4-11: o ToastProvider vive na raiz, e no iOS sheet e modal nativos sao
// apresentados acima dela. Sem o overlay, o toast de erro do sheet de registro
// (com o "Tentar") ficava atras do proprio sheet.
describe('Toast por cima de sheet e modal nativos (F4-11)', () => {
  const erro = { message: 'Não deu pra registrar sua leitura.', tone: 'danger', actionLabel: 'Tentar' };

  beforeEach(() => {
    jest.useFakeTimers();
    mockOverlay.montagens = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('no iOS o toast, e o "Tentar" dele, passam pelo FullWindowOverlay', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onAction = jest.fn();
    const { getByLabelText, getByTestId } = montar({ ...erro, onAction });
    fireEvent.press(getByLabelText('disparar'));

    const overlay = getByTestId('full-window-overlay');
    expect(within(overlay).getByText('Não deu pra registrar sua leitura.')).toBeTruthy();
    fireEvent.press(within(overlay).getByRole('button', { name: 'Tentar' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('no iOS o overlay nao prende o VoiceOver: o toast nao e modal', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { getByLabelText, getByTestId } = montar(erro);
    fireEvent.press(getByLabelText('disparar'));
    expect(getByTestId('full-window-overlay').props.unstable_accessibilityContainerViewIsModal).toBe(false);
  });

  it('sem toast na tela, nao ha overlay na janela', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { queryByTestId } = montar(erro);
    expect(queryByTestId('full-window-overlay')).toBeNull();
    expect(mockOverlay.montagens).toBe(0);
  });

  // O container nativo entra na janela quando o overlay monta. Montado antes de
  // um sheet abrir, ficaria atras dele: por isso cada toast monta o seu.
  it('no iOS cada toast novo monta o overlay de novo', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { getByLabelText, getAllByTestId, rerender } = montar({ message: 'Primeiro' });
    fireEvent.press(getByLabelText('disparar'));
    expect(mockOverlay.montagens).toBe(1);

    rerender(<ToastProvider><Tela opts={erro} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    expect(mockOverlay.montagens).toBe(2);
    expect(getAllByTestId('full-window-overlay')).toHaveLength(1);
  });

  it('no iOS o overlay espera a saida do toast terminar e so entao desmonta', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { getByLabelText, queryByText, queryByTestId } = montar(erro);
    fireEvent.press(getByLabelText('disparar'));

    act(() => { jest.advanceTimersByTime(4000); });
    expect(queryByText('Não deu pra registrar sua leitura.')).toBeNull();
    expect(queryByTestId('full-window-overlay')).not.toBeNull();

    // Um ms antes do fim da saida a camada ainda esta la. Sem este passo o teste
    // nao distinguia "espera motion.exit" de "nao espera nada": timer de 0 ms
    // criado durante o avanco do relogio falso vira 1 ms e so dispara no avanco
    // seguinte (@sinonjs/fake-timers), e a sabotagem com 0 ms passava verde.
    act(() => { jest.advanceTimersByTime(motion.exit.duration - 1); });
    expect(queryByTestId('full-window-overlay')).not.toBeNull();

    act(() => { jest.advanceTimersByTime(1); });
    expect(queryByTestId('full-window-overlay')).toBeNull();
  });

  it('fora do iOS nao usa o overlay, que la nao existe', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { getByLabelText, getByText, queryByTestId } = montar(erro);
    fireEvent.press(getByLabelText('disparar'));

    expect(getByText('Não deu pra registrar sua leitura.')).toBeTruthy();
    expect(queryByTestId('full-window-overlay')).toBeNull();
    expect(mockOverlay.montagens).toBe(0);
  });
});
