import { type ComponentType } from 'react';
import { Pressable, Text } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  Icon?: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export function GhostButton({ children, onPress, Icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        height: 48,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {Icon && <Icon size={16} color={colors.textSoft} strokeWidth={2} />}
      <Text style={{ color: colors.textSoft, fontFamily: fonts.bold, fontSize: 14 }}>
        {children}
      </Text>
    </Pressable>
  );
}
