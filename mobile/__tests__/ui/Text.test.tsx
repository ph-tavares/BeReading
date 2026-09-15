import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Text, STATUS_TONE, type Status } from '../../src/ui/Text';
import { type as typeTokens, color } from '../../src/theme/tokens';

describe('Text', () => {
  it('aplica tamanho, linha e familia da variante', () => {
    const { getByText } = render(<Text variant="heading">Magrathea</Text>);
    const s = StyleSheet.flatten(getByText('Magrathea').props.style);
    expect(s.fontSize).toBe(typeTokens.heading.fontSize);
    expect(s.lineHeight).toBe(typeTokens.heading.lineHeight);
    expect(s.fontFamily).toBe(typeTokens.heading.fontFamily);
  });

  it('usa body como variante padrao', () => {
    const { getByText } = render(<Text>Sem variante</Text>);
    expect(StyleSheet.flatten(getByText('Sem variante').props.style).fontSize).toBe(typeTokens.body.fontSize);
  });

  it.each([
    ['primary', color.text],
    ['secondary', color.text2],
    ['tertiary', color.text3],
    ['accent', color.accent],
    ['positive', color.positive],
    ['danger', color.danger],
    ['inverse', color.accentInk],
  ])('o tone %s pinta com o token certo', (tone, esperado) => {
    const { getByText } = render(<Text tone={tone as any}>Cor</Text>);
    expect(StyleSheet.flatten(getByText('Cor').props.style).color).toBe(esperado);
  });

  it('limita o Dynamic Type para o layout nao quebrar', () => {
    const { getByText } = render(<Text variant="display">Guilherme</Text>);
    expect(getByText('Guilherme').props.maxFontSizeMultiplier)
      .toBe(typeTokens.display.maxFontSizeMultiplier);
  });

  it('numeros usam fonte tabular, para nao pular quando contam', () => {
    const { getByText } = render(<Text variant="numericXL">1840</Text>);
    expect(StyleSheet.flatten(getByText('1840').props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('o style do chamador vence sobre a variante, sem apagar o resto dela', () => {
    const { getByText } = render(
      <Text variant="body" style={{ fontSize: 99, marginTop: 8 }}>X</Text>,
    );
    const s = StyleSheet.flatten(getByText('X').props.style);
    expect(s.fontSize).toBe(99);                                  // o do chamador vence
    expect(s.lineHeight).toBe(typeTokens.body.lineHeight);        // o resto da variante fica
    expect(s.marginTop).toBe(8);                                  // e o que não conflita soma
  });

  it('repassa numberOfLines', () => {
    const { getByText } = render(<Text numberOfLines={2}>Titulo longo</Text>);
    expect(getByText('Titulo longo').props.numberOfLines).toBe(2);
  });
});

describe('STATUS_TONE', () => {
  // Banner e Toast leem este mapa em vez de decidir a cor do texto por conta
  // propria: se o mapa mudar, os dois mudam juntos, sem divergir de novo.
  it.each([
    ['positive', 'positive'],
    ['danger', 'danger'],
    ['info', 'secondary'],
  ])('mapeia o status %s para o tone %s', (status, tone) => {
    expect(STATUS_TONE[status as Status]).toBe(tone);
  });
});
