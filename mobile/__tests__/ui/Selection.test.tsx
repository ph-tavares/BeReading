import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../../src/ui/Chip';
import { Segmented } from '../../src/ui/Segmented';
import { color, MIN_TOUCH } from '../../src/theme/tokens';

describe('Chip', () => {
  it('avisa o leitor de tela quando esta selecionado', () => {
    const { getByRole } = render(<Chip label="Distopia" selected onPress={jest.fn()} />);
    expect(getByRole('button').props.accessibilityState.selected).toBe(true);
  });

  it('o selecionado inverte, em vez de usar mais uma cor', () => {
    const { getByRole } = render(<Chip label="Distopia" selected onPress={jest.fn()} />);
    expect(StyleSheet.flatten(getByRole('button').props.style).backgroundColor).toBe(color.text);
  });

  it('o nao selecionado fica so com borda', () => {
    const { getByRole } = render(<Chip label="Distopia" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(getByRole('button').props.style).backgroundColor).toBe('transparent');
  });

  it('chama onPress no toque', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Chip label="Fantasia" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });

  // DESIGN.md secao 5 lista "disabled" no Chip. O sheet de registro trava os
  // atalhos enquanto envia (Ruling F4-18).
  it('desabilitado: nao chama onPress, avisa o leitor de tela e apaga o rotulo', () => {
    const onPress = jest.fn();
    const { getByRole, getByText } = render(<Chip label="+10" disabled onPress={onPress} />);
    const chip = getByRole('button');
    expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(getByText('+10').props.style).color).toBe(color.text3);
  });
});

describe('Segmented', () => {
  const opcoes = [
    { value: 'lendo', label: 'Lendo · 1' },
    { value: 'lidos', label: 'Lidos · 1' },
  ];

  it('marca a opcao ativa como selecionada', () => {
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={jest.fn()} />,
    );
    expect(getByLabelText('Lendo · 1').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Lidos · 1').props.accessibilityState.selected).toBe(false);
  });

  it('devolve o value da opcao tocada, nao o rotulo', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Lidos · 1'));
    expect(onChange).toHaveBeenCalledWith('lidos');
  });

  it('nao dispara onChange ao tocar na opcao que ja esta ativa', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={onChange} />,
    );
    fireEvent.press(getByLabelText('Lendo · 1'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respeita o alvo minimo de toque em cada opcao', () => {
    // O mockup usa escala ~0.75 do aparelho real: o 34 dali equivale a uns 45
    // reais. Aqui o alvo tem que ser o MIN_TOUCH de verdade.
    const { getByLabelText } = render(
      <Segmented options={opcoes} value="lendo" onChange={jest.fn()} />,
    );
    const s = StyleSheet.flatten(getByLabelText('Lendo · 1').props.style);
    expect(s.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
});
