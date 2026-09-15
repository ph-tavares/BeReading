import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text as RNText } from 'react-native';
import { Card } from '../../src/ui/Card';
import { color, radius, space } from '../../src/theme/tokens';

describe('Card', () => {
  it('pinta a superficie de elevation.surface: color.surface1 e borda color.line', () => {
    const { toJSON } = render(<Card><RNText>conteudo</RNText></Card>);
    const raiz = StyleSheet.flatten((toJSON() as any).props.style);
    expect(raiz.backgroundColor).toBe(color.surface1);
    expect(raiz.borderColor).toBe(color.line);
    expect(raiz.borderRadius).toBe(radius.card);
  });

  it('usa space.lg de padding, nao literal solto', () => {
    const { toJSON } = render(<Card><RNText>conteudo</RNText></Card>);
    const raiz = StyleSheet.flatten((toJSON() as any).props.style);
    expect(raiz.padding).toBe(space.lg);
  });

  it('sem onPress, nao vira botao', () => {
    const { queryByRole, getByText } = render(<Card><RNText>conteudo</RNText></Card>);
    expect(queryByRole('button')).toBeNull();
    expect(getByText('conteudo')).toBeTruthy();
  });

  it('com onPress, vira um botao acessivel e dispara ao tocar', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Card onPress={onPress} accessibilityLabel="Abrir card">
        <RNText>conteudo</RNText>
      </Card>,
    );
    const botao = getByRole('button');
    expect(botao.props.accessibilityLabel).toBe('Abrir card');
    fireEvent.press(botao);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sem sombra: card isolado nao usa elevacao forjada (DESIGN.md secao 9)', () => {
    const { toJSON } = render(<Card><RNText>conteudo</RNText></Card>);
    const raiz = StyleSheet.flatten((toJSON() as any).props.style);
    expect(raiz.shadowOpacity).toBeUndefined();
    expect(raiz.elevation).toBeUndefined();
  });
});
