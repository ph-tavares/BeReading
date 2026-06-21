import { useState, type ComponentType } from 'react';
import { Pressable, Text, Platform, type ViewStyle } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radii, brandTriplet, type BrandColor } from '../theme/tokens';

type HapticStyle = 'light' | 'medium' | 'heavy';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: BrandColor;
  Icon?: ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  /** Intensidade do feedback tátil no press. Default: 'medium'. */
  hapticStyle?: HapticStyle;
}

const HAPTIC_MAP: Record<HapticStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export function Press3DButton({
  children,
  onPress,
  disabled = false,
  size = 'md',
  color = 'green',
  Icon,
  hapticStyle = 'medium',
}: Props) {
  const [down, setDown] = useState(false);
  const h = size === 'lg' ? 64 : size === 'sm' ? 44 : 56;
  const fz = size === 'lg' ? 17 : size === 'sm' ? 14 : 16;
  const iconSize = size === 'lg' ? 22 : 18;
  const triplet = brandTriplet(color);

  // Lip 3D nativo (cross-platform via borderBottomWidth).
  // Halo colorido é pintado pelo <Shadow> wrapper.
  const container: ViewStyle = {
    width: '100%',
    height: h,
    borderRadius: radii.md,
    backgroundColor: disabled ? colors.surface : triplet.color,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    transform: [{ translateY: down ? 6 : 0 }],
    opacity: disabled ? 0.6 : 1,
    borderBottomWidth: disabled ? 0 : (down ? 0 : 6),
    borderBottomColor: triplet.deep,
  };

  function handlePressIn() {
    if (disabled) return;
    setDown(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(HAPTIC_MAP[hapticStyle]).catch(() => {});
    }
  }

  return (
    <Shadow
      distance={disabled ? 0 : 14}
      startColor={triplet.glow}
      offset={[0, 6]}
      stretch
      style={{ width: '100%' }}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={() => setDown(false)}
        style={container}
        disabled={disabled}
      >
        {Icon && <Icon size={iconSize} color="#fff" strokeWidth={2.4} />}
        <Text style={{
          color: disabled ? colors.textMute : '#fff',
          fontFamily: fonts.black,
          fontSize: fz,
          letterSpacing: 0.2,
        }}>{children}</Text>
      </Pressable>
    </Shadow>
  );
}
