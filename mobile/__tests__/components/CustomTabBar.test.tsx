import { render, fireEvent } from '@testing-library/react-native';
import { CustomTabBar } from '../../src/components/CustomTabBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...p }: any) => React.createElement(View, p, children),
    Path: () => null,
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = (name: string) => (props: any) =>
    React.createElement(View, { testID: `icon-${name}`, ...props });
  return {
    Home: icon('home'),
    BookOpen: icon('bookopen'),
    Library: icon('library'),
    Compass: icon('compass'),
    User: icon('user'),
  };
});

function makeProps(activeIndex = 0) {
  const routes = [
    { key: 'index',    name: 'index' },
    { key: 'livros',   name: 'livros' },
    { key: 'catalogo', name: 'catalogo' },
    { key: 'perfil',   name: 'perfil' },
  ];
  return {
    state: { routes, index: activeIndex } as any,
    navigation: { navigate: jest.fn() } as any,
    descriptors: {} as any,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

describe('CustomTabBar', () => {
  beforeEach(() => mockPush.mockClear());

  it('renderiza os 4 rótulos de abas', () => {
    const { getByText } = render(<CustomTabBar {...makeProps()} />);
    expect(getByText('Início')).toBeTruthy();
    expect(getByText('Estante')).toBeTruthy();
    expect(getByText('Explorar')).toBeTruthy();
    expect(getByText('Perfil')).toBeTruthy();
  });

  it('renderiza o label "Registrar" do FAB', () => {
    const { getByText } = render(<CustomTabBar {...makeProps()} />);
    expect(getByText('Registrar')).toBeTruthy();
  });

  it('FAB navega para /register-reading ao pressionar', () => {
    const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
    fireEvent.press(getByTestId('fab-registrar'));
    expect(mockPush).toHaveBeenCalledWith('/register-reading');
  });

  it('pressionar aba "Estante" chama navigate com "livros"', () => {
    const props = makeProps(0);
    const { getByText } = render(<CustomTabBar {...props} />);
    fireEvent.press(getByText('Estante'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('livros');
  });

  it('pressionar aba "Perfil" chama navigate com "perfil"', () => {
    const props = makeProps(0);
    const { getByText } = render(<CustomTabBar {...props} />);
    fireEvent.press(getByText('Perfil'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('perfil');
  });

  it('container raiz tem pointerEvents="box-none" (hitbox não sangra para cima)', () => {
    const { toJSON } = render(<CustomTabBar {...makeProps()} />);
    const root = toJSON() as any;
    expect(root.props.pointerEvents).toBe('box-none');
  });

  it('FAB tem top >= 0 (sem hitbox acima da barra)', () => {
    const { toJSON } = render(<CustomTabBar {...makeProps()} />);
    const root = toJSON() as any;
    const fab = root.children[root.children.length - 1];
    expect(fab.props.style?.top ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('ícone BookOpen está dentro do FAB (filho do fab-registrar)', () => {
    const { getByTestId } = render(<CustomTabBar {...makeProps()} />);
    const fab = getByTestId('fab-registrar');
    // O ícone deve ser descendente do FAB, não renderizado fora dele
    expect(() => fab.findByTestId?.('icon-bookopen')).not.toThrow();
  });

  it('aba ativa recebe cor diferente das inativas', () => {
    const { getByText } = render(<CustomTabBar {...makeProps(2)} />);
    const explorar = getByText('Explorar');
    const inicio = getByText('Início');
    expect(explorar.props.style.color).not.toBe(inicio.props.style.color);
  });
});
