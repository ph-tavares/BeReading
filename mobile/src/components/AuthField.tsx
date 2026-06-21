import { useState, type ComponentType } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  Icon?: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export function AuthField({ label, Icon, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{
        fontFamily: fonts.bold,
        fontSize: 11.5,
        letterSpacing: 0.4,
        color: colors.textSoft,
        marginBottom: 7,
        textTransform: 'uppercase',
      }}>{label}</Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.bgRaise,
        borderWidth: 1.5,
        borderColor: focused ? colors.green : colors.hairline,
      }}>
        {Icon && (
          <View style={{ paddingLeft: 14 }}>
            <Icon size={18} color={focused ? colors.green : colors.textMute} strokeWidth={2} />
          </View>
        )}
        <TextInput
          {...inputProps}
          onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e); }}
          placeholderTextColor={colors.textMute}
          style={{
            flex: 1,
            height: 50,
            paddingHorizontal: Icon ? 10 : 14,
            color: colors.text,
            fontFamily: fonts.medium,
            fontSize: 15,
          }}
        />
      </View>
    </View>
  );
}
