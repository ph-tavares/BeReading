import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { color, radius, space, type as typeTokens } from '../theme/tokens';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensagem de erro. Quando presente, substitui a dica. */
  error?: string;
  hint?: string;
  icon?: IconCmp;
}

// O erro vive no campo, nao num Alert.alert: quem erra a senha precisa ver o
// motivo ao lado do que digitou, nao numa caixa de sistema que some.
export function Field({ label, error, hint, icon: Icon, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const mensagem = error ?? hint;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary" style={styles.label}>{label}</Text>
      <View style={[
        styles.box,
        focused ? styles.focused : null,
        error ? styles.invalid : null,
      ]}>
        {Icon ? <Icon size={18} color={color.text3} strokeWidth={2} /> : null}
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label}
          // Decisao 2: accessibilityInvalid nao existe no React Native — a prop
          // suportada desde a 0.71 e aria-invalid.
          aria-invalid={Boolean(error)}
          placeholderTextColor={color.text3}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={styles.input}
        />
      </View>
      {mensagem ? (
        <Text variant="caption" tone={error ? 'danger' : 'tertiary'} style={styles.msg}>{mensagem}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { marginBottom: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg - 2,
    borderRadius: radius.control,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
  },
  focused: { borderColor: color.text2 },
  invalid: { borderColor: color.danger },
  input: {
    flex: 1,
    color: color.text,
    fontFamily: typeTokens.body.fontFamily,
    fontSize: typeTokens.body.fontSize,
  },
  msg: { marginTop: space.xs + 2 },
});
