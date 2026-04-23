import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radii } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, glow = false, style }: Props) {
  const base: ViewStyle = {
    backgroundColor: colors.bgRaise,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: glow ? colors.purple : '#000',
    shadowOffset: { width: 0, height: glow ? 20 : 10 },
    shadowOpacity: glow ? 0.5 : 0.6,
    shadowRadius: glow ? 40 : 30,
    elevation: glow ? 8 : 4,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          pressed && { transform: [{ translateY: 2 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
