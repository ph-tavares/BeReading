import { render } from '@testing-library/react-native';
import { ScrollView, Text as RNText } from 'react-native';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_HEIGHT } from '../../src/ui/TabBar';
import { color } from '../../src/theme/tokens';

// Sobrescreve o mock global (insets zerados, ver jest.setup.ui.js) com insets
// nao triviais: sem isso, um paddingTop fixo passaria pelo teste por
// coincidencia, exatamente o defeito que o Screen substitui (TopBar antigo
// com paddingTop:58).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('Screen', () => {
  it('usa os insets reais no topo, nunca um numero fixo', () => {
    const { getByTestId } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const s = getByTestId('screen-root').props.style;
    const paddingTop = Array.isArray(s) ? s.find((x) => x?.paddingTop)?.paddingTop : s.paddingTop;
    expect(paddingTop).toBe(47);
  });

  it('fundo da tela usa o token color.bg', () => {
    const { getByTestId } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const s = getByTestId('screen-root').props.style;
    const backgroundColor = Array.isArray(s)
      ? s.find((x) => x?.backgroundColor)?.backgroundColor
      : s.backgroundColor;
    expect(backgroundColor).toBe(color.bg);
  });

  it('sem onBack, nao ha botao de voltar', () => {
    const { queryByLabelText } = render(
      <Screen title="Hoje"><RNText>conteudo</RNText></Screen>,
    );
    expect(queryByLabelText('Voltar')).toBeNull();
  });

  it('com onBack, mostra o botao de voltar acessivel', () => {
    const onBack = jest.fn();
    const { getByLabelText } = render(
      <Screen title="Hoje" onBack={onBack}><RNText>conteudo</RNText></Screen>,
    );
    expect(getByLabelText('Voltar')).toBeTruthy();
  });

  it('titulo e subtitulo aparecem quando informados', () => {
    const { getByText } = render(
      <Screen title="Hoje" subtitle="E ai, Breq"><RNText>conteudo</RNText></Screen>,
    );
    expect(getByText('Hoje')).toBeTruthy();
    expect(getByText('E ai, Breq')).toBeTruthy();
  });

  it('sem onRefresh, o ScrollView nao monta RefreshControl', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    expect(UNSAFE_getByType(ScrollView).props.refreshControl).toBeUndefined();
  });

  it('com onRefresh, monta o RefreshControl com a cor do token de acento', () => {
    const { UNSAFE_getByType } = render(
      <Screen refreshing={false} onRefresh={jest.fn()}><RNText>conteudo</RNText></Screen>,
    );
    const rc = UNSAFE_getByType(ScrollView).props.refreshControl;
    expect(rc).toBeTruthy();
    expect(rc.props.tintColor).toBe(color.accent);
  });

  it('reserva no fim do scroll espaco para a tab bar, a partir de TAB_BAR_HEIGHT', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const style = UNSAFE_getByType(ScrollView).props.contentContainerStyle;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.paddingBottom).toBe(TAB_BAR_HEIGHT + 34);
  });

  it('esconde o indicador vertical de scroll', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    expect(UNSAFE_getByType(ScrollView).props.showsVerticalScrollIndicator).toBe(false);
  });

  // Achado 3 da rodada de correcao 1: com 'bottom' em edges (tela sem tab
  // bar), o insets.bottom nao pode entrar duas vezes (raiz + scroll), e a
  // reserva de TAB_BAR_HEIGHT nao faz sentido numa tela sem barra.
  it('com edges incluindo bottom, nao soma TAB_BAR_HEIGHT nem repete o inset no scroll', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <Screen edges={['top', 'bottom']}><RNText>conteudo</RNText></Screen>,
    );
    const raiz = getByTestId('screen-root').props.style;
    const paddingBottomRaiz = Array.isArray(raiz)
      ? raiz.find((x) => x?.paddingBottom)?.paddingBottom
      : raiz.paddingBottom;
    expect(paddingBottomRaiz).toBe(34);

    const scrollStyle = UNSAFE_getByType(ScrollView).props.contentContainerStyle;
    const flat = Array.isArray(scrollStyle) ? Object.assign({}, ...scrollStyle.filter(Boolean)) : scrollStyle;
    expect(flat.paddingBottom).toBe(0);
  });

  // Achado 4 da rodada de correcao 1: scroll={false} nao reservava espaco
  // nenhum para a tab bar, armadilha viva para as telas da F4.
  it('com scroll={false}, reserva o mesmo espaco de tab bar do caminho com scroll', () => {
    const { getByTestId } = render(
      <Screen scroll={false}><RNText>conteudo</RNText></Screen>,
    );
    const s = getByTestId('screen-content').props.style;
    const flat = Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s;
    expect(flat.paddingBottom).toBe(TAB_BAR_HEIGHT + 34);
  });
});
