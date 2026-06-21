import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function PageField({ label, value, onChange, placeholder }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{
        fontFamily: fonts.black,
        fontSize: 10.5,
        letterSpacing: 1.5,
        color: focused ? colors.green : colors.textMute,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>{label}</Text>
      <View style={{
        height: 84,
        borderRadius: radii.md,
        backgroundColor: colors.bgRaise,
        borderWidth: 2,
        borderColor: focused ? colors.green : colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          maxLength={4}
          style={{
            width: '100%',
            textAlign: 'center',
            color: colors.text,
            fontFamily: fonts.black,
            fontSize: 34,
            letterSpacing: -0.5,
          }}
        />
      </View>
    </View>
  );
}
