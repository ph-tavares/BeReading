import { useCallback } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text, TONE_COLOR } from './Text';
import { color, radius, space, motion, MIN_TOUCH } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';
type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  children: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconCmp;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const BG: Record<Variant, string> = {
  primary: color.accent,
  secondary: color.surface2,
  ghost: 'transparent',
  destructive: color.dangerSoft,
};

const INK: Record<Variant, 'inverse' | 'primary' | 'secondary' | 'danger'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'secondary',
  destructive: 'danger',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Sai o labio 3D de 6px do Press3DButton: o toque e respondido por escala, cor e
// haptic. Desabilitado nao usa opacidade — o texto continua legivel, com o
// contraste do token text3 sobre surface2.
export function Button({
  children, onPress, variant = 'primary', size = 'lg', icon: Icon,
  loading = false, disabled = false, accessibilityLabel, style,
}: Props) {
  const inativo = disabled || loading;
  const scale = useSharedValue(1);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    if (inativo) return;
    scale.value = withSpring(motion.press.scale, motion.press);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [inativo, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.press);
  }, [scale]);

  const fundo = inativo ? color.surface2 : BG[variant];
  const tinta = inativo ? 'tertiary' : INK[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inativo, busy: loading }}
      onPress={inativo ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inativo}
      style={[
        styles.base,
        { height: size === 'lg' ? 50 : MIN_TOUCH, backgroundColor: fundo },
        variant === 'secondary' && !inativo ? styles.bordered : null,
        animado,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color.text3} />
      ) : (
        // O icone usa a mesma tabela de tom do Text ao lado, em vez de so
        // distinguir 'inverse': senao ghost/desabilitado ficam com icone
        // aceso e texto apagado.
        Icon ? <Icon size={18} color={TONE_COLOR[tinta]} strokeWidth={2.2} /> : null
      )}
      <Text variant="button" tone={tinta}>{children}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
  },
  bordered: { borderWidth: 1, borderColor: color.line2 },
});
