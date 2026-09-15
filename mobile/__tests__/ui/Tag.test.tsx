import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Tag } from '../../src/ui/Tag';
import { color } from '../../src/theme/tokens';

// Icone de mentira so para provar que o Tag nao expoe ele como no separado
// para leitor de tela. Sem size/color de verdade porque o teste nunca chega
// a olhar para dentro do svg, so para a arvore de acessibilidade em volta.
function IconeFalso() {
  return null;
}

describe('Tag', () => {
  it('nao e tocavel: sem role de botao, mesmo tendo texto e icone', () => {
    const { queryByRole } = render(<Tag label="+120 XP" icon={IconeFalso} />);
    expect(queryByRole('button')).toBeNull();
  });

  it('mostra o rotulo', () => {
    const { getByText } = render(<Tag label="4 dias seguidos" />);
    expect(getByText('4 dias seguidos')).toBeTruthy();
  });

  it('o icone fica escondido do leitor de tela, o texto ao lado ja basta', () => {
    const { UNSAFE_getByProps } = render(<Tag label="nota 85 · +40 XP" icon={IconeFalso} />);
    const escondido = UNSAFE_getByProps({ importantForAccessibility: 'no-hide-descendants' });
    expect(escondido.props.accessibilityElementsHidden).toBe(true);
  });

  it.each([
    ['neutral', color.surface2, color.text2],
    ['accent', color.accentSoft, color.accent],
    ['positive', color.positiveSoft, color.positive],
    ['danger', color.dangerSoft, color.danger],
  ])('o tom %s pinta fundo e texto com o par certo', (tone, bg, texto) => {
    const { getByText, toJSON } = render(<Tag label="Romance" tone={tone as any} />);
    expect(StyleSheet.flatten(getByText('Romance').props.style).color).toBe(texto);

    // O retorno do componente e a propria View com o fundo (mesmo raciocinio
    // de ListRow.test.tsx): o toJSON() da raiz ja e esse no.
    const fundo = StyleSheet.flatten((toJSON() as any).props.style);
    expect(fundo.backgroundColor).toBe(bg);
  });

  it('tom padrao e neutro quando ninguem escolhe um', () => {
    const { getByText } = render(<Tag label="312 páginas" />);
    const rotulo = getByText('312 páginas');
    expect(StyleSheet.flatten(rotulo.props.style).color).toBe(color.text2);
  });
});
