import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Skeleton } from '../../src/ui/Skeleton';
import { EmptyState } from '../../src/ui/EmptyState';
import { Banner, type BannerTone } from '../../src/ui/Banner';
import { ListRow } from '../../src/ui/ListRow';
import { MIN_TOUCH, color } from '../../src/theme/tokens';
import { TONE_COLOR } from '../../src/ui/Text';

// O mock oficial de react-native-reanimated (usado globalmente no
// jest.setup.ui.js) deixa useReducedMotion de fora de proposito — o proprio
// arquivo do pacote comenta "ADD ME IF NEEDED". Sobrescreve so aqui, sem
// tocar no setup global, que outras suites tambem usam. Os dois viram
// controlaveis por teste (variavel + spy, prefixo "mock" exigido pelo
// hoisting do jest.mock) para provar os dois caminhos do Skeleton, nao so
// declarar que o codigo "parece" certo.
let mockReducedMotion = false;
// Assinatura em rest parameter, nao um unico argumento: espalhar um
// `unknown[]` (nao tupla) numa funcao de um parametro so e erro de tipo
// (TS2556). Com rest parameter, o spread abaixo aceita.
const mockWithRepeat = jest.fn((...args: unknown[]) => args[0]);

jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return {
    ...real,
    useReducedMotion: () => mockReducedMotion,
    withRepeat: (...args: unknown[]) => mockWithRepeat(...args),
  };
});

beforeEach(() => {
  mockReducedMotion = false;
  mockWithRepeat.mockClear();
});

describe('Skeleton', () => {
  it('se anuncia como carregando, para o leitor de tela nao ler caixa vazia', () => {
    const { getByLabelText } = render(<Skeleton width={100} height={12} />);
    expect(getByLabelText('Carregando')).toBeTruthy();
  });

  it('pulsa quando o usuario nao pediu menos movimento', () => {
    render(<Skeleton width={100} height={12} />);
    expect(mockWithRepeat).toHaveBeenCalled();
  });

  it('nao inicia a animacao com reduce motion ligado', () => {
    mockReducedMotion = true;
    render(<Skeleton width={100} height={12} />);
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('mostra titulo, explicacao e acao', () => {
    const { getByText, getByRole } = render(
      <EmptyState
        title="Estante vazia, por enquanto"
        description="Escolhe o primeiro livro no Explorar."
        actionLabel="Explorar livros"
        onAction={jest.fn()}
      />,
    );
    expect(getByText('Estante vazia, por enquanto')).toBeTruthy();
    expect(getByText('Escolhe o primeiro livro no Explorar.')).toBeTruthy();
    expect(getByRole('button')).toBeTruthy();
  });

  it('dispara a acao', () => {
    const onAction = jest.fn();
    const { getByRole } = render(
      <EmptyState title="T" description="D" actionLabel="Ir" onAction={onAction} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  it('sem acao, nao renderiza botao', () => {
    const { queryByRole } = render(<EmptyState title="T" description="D" />);
    expect(queryByRole('button')).toBeNull();
  });

  it('por padrao desenha as lombadas', () => {
    const { getByTestId } = render(<EmptyState title="T" description="D" />);
    expect(getByTestId('empty-spines')).toBeTruthy();
  });

  it('illustration="none" tira a ilustracao (erro de perfil, sucesso de checkout)', () => {
    const { queryByTestId } = render(<EmptyState title="T" description="D" illustration="none" />);
    expect(queryByTestId('empty-spines')).toBeNull();
  });

  it('aceita ilustracao propria no lugar das lombadas (o Glyph do assistente, na F5)', () => {
    const { getByText, queryByTestId } = render(
      <EmptyState title="T" description="D" illustration={<RNText>Orelha</RNText>} />,
    );
    expect(getByText('Orelha')).toBeTruthy();
    expect(queryByTestId('empty-spines')).toBeNull();
  });

  it('acao secundaria aparece como botao proprio e dispara', () => {
    const onSecondary = jest.fn();
    const { getByRole } = render(
      <EmptyState
        title="T" description="D" actionLabel="Tentar de novo" onAction={jest.fn()}
        secondaryLabel="Voltar pro livro" onSecondary={onSecondary}
      />,
    );
    fireEvent.press(getByRole('button', { name: 'Voltar pro livro' }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

describe('Banner', () => {
  it('mostra a mensagem e o botao de tentar de novo', () => {
    const onRetry = jest.fn();
    const { getByText, getByRole } = render(
      <Banner tone="danger" message="Caiu a internet. O que você registrou tá salvo." onRetry={onRetry} />,
    );
    expect(getByText('Caiu a internet. O que você registrou tá salvo.')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('se anuncia como alerta', () => {
    const { getByRole } = render(<Banner tone="danger" message="Falhou" />);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('usa live region "polite", sem a qual o TalkBack nao anuncia o alert sozinho', () => {
    const { getByRole } = render(<Banner tone="danger" message="Falhou" />);
    expect(getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
  });

  it('sem onRetry, nao renderiza botao', () => {
    const { queryByRole } = render(<Banner tone="info" message="Só um aviso" />);
    expect(queryByRole('button')).toBeNull();
  });

  // Duas variantes, nao tres (DESIGN.md secao 5). O `positive` saiu daqui junto
  // com a prop: banner e persistente e "some quando a causa e corrigida", e
  // sucesso nao tem causa a corrigir.
  //
  // Sem `as const` e sem `satisfies`, o it.each infere `string` e a unica forma
  // de compilar seria um `as any` no `tone` — que era o que estava aqui, e que
  // anulava exatamente a checagem que importa. Com o tipo preservado, escrever
  // 'positive' de volta nesta tabela para de compilar.
  const TONS = [
    ['danger', color.dangerSoft, color.danger],
    ['info', color.surface1, color.line],
  ] as const satisfies readonly (readonly [BannerTone, string, string])[];

  it.each(TONS)('o tom %s pinta fundo e borda com o par certo', (tone, bg, border) => {
    const { getByRole } = render(<Banner tone={tone} message="Aviso" />);
    const estilo = StyleSheet.flatten(getByRole('alert').props.style);
    expect(estilo.backgroundColor).toBe(bg);
    expect(estilo.borderColor).toBe(border);
  });
});

describe('ListRow', () => {
  it('e um botao com label quando tocavel', () => {
    const { getByRole } = render(
      <ListRow title="Capítulo 4" subtitle="p. 61 a 85" accessibilityLabel="Capítulo 4, quiz feito" onPress={jest.fn()} />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Capítulo 4, quiz feito');
  });

  it('nao vira botao quando nao tem onPress', () => {
    const { queryByRole, getByText } = render(<ListRow title="Capítulo 4" />);
    expect(queryByRole('button')).toBeNull();
    expect(getByText('Capítulo 4')).toBeTruthy();
  });

  it('anuncia desabilitado e nao dispara quando trancado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ListRow title="Capítulo 6" accessibilityLabel="Capítulo 6, trancado" onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('renderiza leading e trailing', () => {
    const { getByText } = render(
      <ListRow
        title="Capítulo 4"
        leading={<RNText>L</RNText>}
        trailing={<RNText>92</RNText>}
      />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('92')).toBeTruthy();
  });

  it('respeita o alvo minimo de toque na linha', () => {
    // Sem onPress, o retorno do componente e a propria View da linha: o
    // toJSON() da raiz ja e o no com o minHeight, sem precisar navegar a
    // arvore (o Pressable, quando existe, nao carrega esse estilo — quem
    // carrega e o View interno que ele envolve).
    const { toJSON } = render(<ListRow title="Capítulo 4" />);
    const linha = StyleSheet.flatten((toJSON() as any).props.style);
    expect(linha.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('tom destrutivo pinta o titulo com a cor de perigo (excluir conta, sair)', () => {
    const { getByText } = render(<ListRow title="Excluir conta" tone="destructive" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(getByText('Excluir conta').props.style).color).toBe(TONE_COLOR.danger);
  });

  it('carregando: anuncia ocupado, mostra indicador e nao dispara de novo', () => {
    const onPress = jest.fn();
    const { getByRole, getByTestId } = render(
      <ListRow title="Excluir conta" tone="destructive" loading onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(getByTestId('list-row-loading')).toBeTruthy();
  });
});
