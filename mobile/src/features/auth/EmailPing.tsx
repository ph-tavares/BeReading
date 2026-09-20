// Envelope com "ping" da confirmacao de e-mail (spec 7.10): ambar, mais lento
// que o antigo e parado com reduce motion. Decorativo: fica fora da arvore de
// acessibilidade, o titulo da tela ja diz o que esta acontecendo.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Mail } from 'lucide-react-native';
import { color, radius } from '../../theme/tokens';

const TAMANHO = 112;
const CICLO_MS = 3200;

export function EmailPing() {
  const semMovimento = useReducedMotion();
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);

  useEffect(() => {
    if (semMovimento) return;
    p1.value = withRepeat(withTiming(1, { duration: CICLO_MS }), -1, false);
    p2.value = withDelay(CICLO_MS / 2, withRepeat(withTiming(1, { duration: CICLO_MS }), -1, false));
    return () => {
      cancelAnimation(p1);
      cancelAnimation(p2);
    };
  }, [semMovimento, p1, p2]);

  const anel1 = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - p1.value), transform: [{ scale: 1 + 0.7 * p1.value }] }));
  const anel2 = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - p2.value), transform: [{ scale: 1 + 0.7 * p2.value }] }));

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {semMovimento ? null : (
        <>
          <Animated.View testID="email-ping" style={[styles.anel, anel1]} />
          <Animated.View style={[styles.anel, anel2]} />
        </>
      )}
      <View style={styles.circulo}>
        <Mail size={44} color={color.accent} strokeWidth={1.8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: TAMANHO, height: TAMANHO, alignSelf: 'center' },
  anel: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  circulo: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
