import { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, useReducedMotion } from 'react-native-reanimated';
import { color, motion, radius } from '../theme/tokens';

interface Props {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
}

// Skeleton no formato do conteudo, em vez de spinner de tela cheia: a tela ja
// mostra a forma do que vai chegar, entao nao ha salto quando chega.
export function Skeleton({ width, height, borderRadius = radius.tag }: Props) {
  const opacity = useSharedValue(0.5);
  const semMovimento = useReducedMotion();

  useEffect(() => {
    if (semMovimento) return;
    // motion.pulse, nao motion.skeleton: skeleton e o crossfade de 200ms para
    // o conteudo real ao terminar, um proposito diferente do pulso em loop.
    opacity.value = withRepeat(withTiming(1, { duration: motion.pulse.duration }), -1, true);
  }, [opacity, semMovimento]);

  const animado = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible
      accessibilityLabel="Carregando"
      style={[styles.base, { width, height, borderRadius }, animado]}
    />
  );
}

const styles = StyleSheet.create({ base: { backgroundColor: color.surface2 } });
