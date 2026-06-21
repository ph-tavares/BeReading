import { type ComponentType } from 'react';
import { Pressable, Text } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  color?: string;
  Icon?: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

export function Chip({ children, onPress, active = false, color = colors.text, Icon }: Props) {
  const tint = active ? color : colors.textSoft;
  const border = active ? color : colors.hairline;
  const bg = active ? `${color}22` : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {Icon && <Icon size={14} color={tint} strokeWidth={2.2} />}
      <Text style={{ color: tint, fontFamily: fonts.bold, fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}
