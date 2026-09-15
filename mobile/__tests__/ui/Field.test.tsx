import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Field } from '../../src/ui/Field';
import { PageField } from '../../src/ui/PageField';
import { color } from '../../src/theme/tokens';

describe('Field', () => {
  it('associa o rotulo ao campo para o leitor de tela', () => {
    const { getByLabelText } = render(
      <Field label="E-mail" value="" onChangeText={jest.fn()} />,
    );
    expect(getByLabelText('E-mail')).toBeTruthy();
  });

  it('mostra o erro no campo, nao num alerta', () => {
    const { getByText } = render(
      <Field label="Senha" value="123" onChangeText={jest.fn()} error="Mínimo de 6 caracteres" />,
    );
    expect(getByText('Mínimo de 6 caracteres')).toBeTruthy();
  });

  it('anuncia o estado invalido', () => {
    // Decisao 2: aria-invalid, nao accessibilityInvalid — esta prop nao existe
    // no React Native, e o teste passaria comparando undefined com undefined.
    const { getByLabelText } = render(
      <Field label="Senha" value="1" onChangeText={jest.fn()} error="Curta" />,
    );
    expect(getByLabelText('Senha').props['aria-invalid']).toBe(true);
  });

  it('mostra a dica quando nao ha erro', () => {
    const { getByText } = render(
      <Field label="Senha" value="" onChangeText={jest.fn()} hint="Mínimo de 6 caracteres" />,
    );
    expect(getByText('Mínimo de 6 caracteres')).toBeTruthy();
  });

  it('o erro substitui a dica, para nao empilhar mensagem', () => {
    const { getByText, queryByText } = render(
      <Field label="Senha" value="1" onChangeText={jest.fn()} hint="Dica" error="Erro" />,
    );
    expect(getByText('Erro')).toBeTruthy();
    expect(queryByText('Dica')).toBeNull();
  });

  it('repassa o texto digitado', () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
      <Field label="Nome" value="" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByLabelText('Nome'), 'Guilherme');
    expect(onChangeText).toHaveBeenCalledWith('Guilherme');
  });

  it('muda a borda no foco e volta ao perder o foco', () => {
    const { getByLabelText } = render(
      <Field label="Nome" value="" onChangeText={jest.fn()} />,
    );
    // input.parent e o proprio composite TextInput; a View com a borda (o
    // "box") fica um nivel acima disso.
    const input = getByLabelText('Nome');
    const box = input.parent!.parent!;
    fireEvent(input, 'focus');
    expect(StyleSheet.flatten(box.props.style).borderColor).toBe(color.text2);
    fireEvent(input, 'blur');
    expect(StyleSheet.flatten(box.props.style).borderColor).toBe(color.line);
  });
});

describe('PageField', () => {
  it('descarta o que nao e digito, porque pagina nao tem letra', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <PageField label="Até" value="" onChange={onChange} accessibilityLabel="Página final" />,
    );
    fireEvent.changeText(getByLabelText('Página final'), '1a2b');
    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('abre o teclado numerico', () => {
    const { getByLabelText } = render(
      <PageField label="De" value="85" onChange={jest.fn()} accessibilityLabel="Página inicial" />,
    );
    expect(getByLabelText('Página inicial').props.keyboardType).toBe('number-pad');
  });

  it('abre em foco quando pedido: o sheet de registro poe o cursor no Ate', () => {
    const { getByLabelText } = render(
      <PageField label="Até" value="" onChange={jest.fn()} autoFocus accessibilityLabel="Página final" />,
    );
    expect(getByLabelText('Página final').props.autoFocus).toBe(true);
  });

  // DESIGN.md secao 5: PageField tem os estados do Field, disabled incluido. O
  // sheet de registro trava os campos enquanto envia (Ruling F4-18).
  it('desabilitado: nao edita, avisa o leitor de tela e apaga o numero', () => {
    const { getByLabelText } = render(
      <PageField label="De" value="85" onChange={jest.fn()} disabled accessibilityLabel="Página inicial" />,
    );
    const input = getByLabelText('Página inicial');
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(StyleSheet.flatten(input.props.style).color).toBe(color.text3);
  });

  it('limita o tamanho pelo total de paginas do livro', () => {
    const { getByLabelText } = render(
      <PageField label="Até" value="" onChange={jest.fn()} max={215} accessibilityLabel="Página final" />,
    );
    expect(getByLabelText('Página final').props.maxLength).toBe(3);
  });

  it('muda a borda no foco e volta ao perder o foco', () => {
    const { getByLabelText } = render(
      <PageField label="De" value="" onChange={jest.fn()} accessibilityLabel="Página inicial" />,
    );
    const input = getByLabelText('Página inicial');
    const box = input.parent!.parent!;
    fireEvent(input, 'focus');
    expect(StyleSheet.flatten(box.props.style).borderColor).toBe(color.text2);
    fireEvent(input, 'blur');
    expect(StyleSheet.flatten(box.props.style).borderColor).toBe(color.line);
  });
});
