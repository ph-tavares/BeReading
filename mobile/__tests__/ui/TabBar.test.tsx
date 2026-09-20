import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TabBar, TAB_BAR_HEIGHT } from '../../src/ui/TabBar';
import { MIN_TOUCH } from '../../src/theme/tokens';

// Mesma tecnica do Button.test.tsx: espiona o haptic em vez de depender do
// modulo nativo, que nao existe no ambiente de teste.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Sobrescreve o mock global (insets zerados, ver jest.setup.ui.js) com
// valores nao redondos de proposito, mesmo padrao do Screen.test.tsx: sem
// isso, uma regressao que trocasse insets.bottom por 0 passaria pela suite
// inteira sem acusar nada (era exatamente o defeito da barra antiga, com
// faixa fixa de 28px). O componente le o inset pelo proprio hook, nao pela
// prop `insets` de BottomTabBarProps — por isso o mock de modulo, nao um
// valor no objeto de props.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

// O destino do botao central chega por prop: `src/ui` nao importa
// `expo-router` (ver o cabecalho de TabBar.tsx). Um espiao simples basta, e o
// teste deixou de depender de mock de modulo.
const onPressRegistrar = jest.fn();

import * as Haptics from 'expo-haptics';

// Os nomes de rota nao mudam (deep link): index, livros, catalogo, perfil.
// Ver src/components/CustomTabBar.tsx, que usa os mesmos quatro.
function makeProps(activeIndex = 0, descriptors: Record<string, { options: any }> = {}) {
  const routes = [
    { key: 'index', name: 'index' },
    { key: 'livros', name: 'livros' },
    { key: 'catalogo', name: 'catalogo' },
    { key: 'perfil', name: 'perfil' },
  ];
  return {
    state: { routes, index: activeIndex } as any,
    navigation: { navigate: jest.fn() } as any,
    // So bate a forma de BottomTabBarProps: o componente usa o proprio
    // useSafeAreaInsets(), mockado acima, nao esta prop.
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    descriptors: descriptors as any,
    onPressRegistrar,
  };
}

describe('TabBar', () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
    onPressRegistrar.mockClear();
  });

  it('mostra os quatro rotulos e o botao central', () => {
    const { getByText, getByTestId } = render(<TabBar {...makeProps()} />);
    expect(getByText('Hoje')).toBeTruthy();
    expect(getByText('Estante')).toBeTruthy();
    expect(getByText('Explorar')).toBeTruthy();
    expect(getByText('Você')).toBeTruthy();
    expect(getByTestId('fab-registrar')).toBeTruthy();
  });

  // BER-120: o FAB volta. Ele foi tirado na F3 e isso deixou
  // `app/register-reading.tsx` sem nenhum caminho no app inteiro — o defeito
  // que a guarda de rotas documenta. Agora ele SOMA ao botao da Hoje, nao
  // substitui: sao dois caminhos para a acao central do produto.
  it('o botao central dispara a acao de registrar, e com haptic de acao primaria', () => {
    const { getByTestId } = render(<TabBar {...makeProps()} />);
    fireEvent.press(getByTestId('fab-registrar'));
    expect(onPressRegistrar).toHaveBeenCalledTimes(1);
    // Medio, contra o leve das abas: e' a acao central do produto.
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('o botao central nao e aba: leitor de tela ouve quatro abas, nao cinco', () => {
    const props = makeProps();
    const { getByTestId, getAllByRole } = render(<TabBar {...props} />);
    expect(getByTestId('fab-registrar').props.accessibilityRole).toBe('button');
    expect(getAllByRole('tab')).toHaveLength(4);
    // E nao navega como aba nenhuma.
    fireEvent.press(getByTestId('fab-registrar'));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('o botao central respeita o alvo minimo de toque', () => {
    const { getByTestId } = render(<TabBar {...makeProps()} />);
    const s = StyleSheet.flatten(getByTestId('fab-registrar').props.style);
    expect(s.width).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(s.height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('navega e vibra leve ao tocar em uma aba diferente da ativa', () => {
    const props = makeProps(0);
    const { getByLabelText } = render(<TabBar {...props} />);
    fireEvent.press(getByLabelText('Estante'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('livros');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('nao navega nem vibra ao tocar na aba ja ativa', () => {
    const props = makeProps(0);
    const { getByLabelText } = render(<TabBar {...props} />);
    fireEvent.press(getByLabelText('Hoje'));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('marca a aba ativa com accessibilityState selected, e so ela', () => {
    const { getByLabelText } = render(<TabBar {...makeProps(1)} />);
    expect(getByLabelText('Estante').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Hoje').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Explorar').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Você').props.accessibilityState.selected).toBe(false);
  });

  // Achado 6 da rodada 1: o teste anterior conferia so a primeira aba,
  // embora o criterio de aceite diga "cada aba".
  it('cada uma das quatro abas declara accessibilityRole tab', () => {
    const { getByLabelText } = render(<TabBar {...makeProps()} />);
    expect(getByLabelText('Hoje').props.accessibilityRole).toBe('tab');
    expect(getByLabelText('Estante').props.accessibilityRole).toBe('tab');
    expect(getByLabelText('Explorar').props.accessibilityRole).toBe('tab');
    expect(getByLabelText('Você').props.accessibilityRole).toBe('tab');
  });

  it('TAB_BAR_HEIGHT e maior que o alvo minimo de toque', () => {
    expect(TAB_BAR_HEIGHT).toBeGreaterThan(MIN_TOUCH);
  });

  // Achado 1 da rodada 1: sem este teste, trocar TAB_BAR_HEIGHT + insets.bottom
  // por TAB_BAR_HEIGHT + 0 passava pela suite inteira sem acusar nada — a
  // barra antiga, com faixa fixa, tinha exatamente esse defeito.
  it('a altura e o paddingBottom da barra vem de insets.bottom reais, nao de zero', () => {
    const { getByTestId } = render(<TabBar {...makeProps()} />);
    const s = StyleSheet.flatten(getByTestId('tab-bar').props.style);
    expect(s.height).toBe(TAB_BAR_HEIGHT + 34);
    expect(s.paddingBottom).toBe(34);
  });

  // Achado 2 da rodada 1: a Tarefa 4 define `title` em cada Tabs.Screen; sem
  // ler options aqui, esse title nunca tinha efeito na barra.
  it('usa o title de options quando presente, em vez do rotulo interno', () => {
    const props = makeProps(0, { livros: { options: { title: 'Minha Estante' } } });
    const { getByText, queryByText } = render(<TabBar {...props} />);
    expect(getByText('Minha Estante')).toBeTruthy();
    expect(queryByText('Estante')).toBeNull();
  });

  it('sem title nem tabBarLabel em options, cai no rotulo interno (fallback)', () => {
    const props = makeProps(0, { livros: { options: {} } });
    const { getByText } = render(<TabBar {...props} />);
    expect(getByText('Estante')).toBeTruthy();
  });

  // Achado da revisao final da F3: icone e rotulo vinham de duas fontes
  // paralelas (color.text/color.text3 no SVG, 'primary'/'tertiary' no Text) que
  // por acaso davam na mesma cor. Uma troca em TONE_COLOR deixaria o icone de
  // uma cor e a palavra embaixo de outra, sem nada acusando. Este teste compara
  // as duas cores renderizadas: se divergirem de novo, reprova.
  it('o icone e o rotulo da mesma aba tem exatamente a mesma cor', () => {
    const { getByText, UNSAFE_getAllByType } = render(<TabBar {...makeProps(0)} />);
    const { Path } = require('react-native-svg');

    const corDoRotulo = (rotulo: string) =>
      StyleSheet.flatten(getByText(rotulo).props.style).color;

    // O Path da casinha (aba ativa) e o da estante (inativa) — primeiro traco
    // de cada icone, na ordem em que as abas sao renderizadas.
    const tracos = UNSAFE_getAllByType(Path);
    const corAtiva = tracos[0].props.stroke;
    const corInativa = tracos[1].props.stroke;

    expect(corAtiva).toBe(corDoRotulo('Hoje'));
    expect(corInativa).toBe(corDoRotulo('Estante'));
    // E a ativa precisa mesmo se distinguir da inativa, senao o teste acima
    // passaria com a barra inteira de uma cor so.
    expect(corAtiva).not.toBe(corInativa);
  });
});
