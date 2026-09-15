import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space, type as typeTokens } from '../theme/tokens';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Total de paginas do livro: define quantos digitos cabem. */
  max?: number;
  accessibilityLabel: string;
  /**
   * Abre com o cursor no campo. O Field ja repassa toda prop de TextInput; o
   * PageField nao repassava nenhuma, e o sheet de registro precisa do "Ate"
   * em foco (spec S7.2).
   */
  autoFocus?: boolean;
  /**
   * Estado disabled do Field (DESIGN.md secao 5): nao edita, numero em text3 e
   * anunciado como desabilitado. O sheet de registro trava os campos enquanto
   * envia.
   */
  disabled?: boolean;
}

export function PageField({
  label, value, onChange, placeholder, max, accessibilityLabel, autoFocus, disabled = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const maxLength = max ? String(max).length : 4;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone={focused ? 'accent' : 'secondary'} style={styles.label}>{label}</Text>
      <View style={[styles.box, focused ? styles.focused : null]}>
        <TextInput
          value={value}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          editable={!disabled}
          // Pagina nao tem letra: o teclado numerico ainda deixa colar texto.
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={color.text3}
          keyboardType="number-pad"
          autoFocus={autoFocus}
          maxLength={maxLength}
          style={[styles.input, disabled ? styles.inputInativo : null]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { marginBottom: space.sm - 2 },
  box: {
    height: 72,
    borderRadius: radius.card - 4,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focused: { borderColor: color.text2 },
  input: {
    width: '100%',
    textAlign: 'center',
    color: color.text,
    // fontSize e letterSpacing vem inteiros do token: nenhum numero de fonte
    // solto em src/ui (guarda da Tarefa 17).
    fontFamily: typeTokens.numericXL.fontFamily,
    fontSize: typeTokens.numericXL.fontSize,
    letterSpacing: typeTokens.numericXL.letterSpacing,
  },
  inputInativo: { color: color.text3 },
});
