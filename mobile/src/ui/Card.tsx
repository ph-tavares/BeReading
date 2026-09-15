// Card generico: superficie isolada de conteudo, tocavel ou nao.
//
// Nasceu na rodada de correcao da Tarefa 4 (F4): AssistantCard tinha montado
// a mao a primeira "card chrome" do design system novo (surface1 + borda
// line + radius.card + padding), decisao de sistema tomada dentro de um
// arquivo de feature. O token ja existia (elevation.surface, DESIGN.md
// secao 4: "color.surface1 + borda color.line, para card tocavel"); faltava
// so o componente.
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, radius, space, motion } from '../theme/tokens';

interface BaseProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

interface TocavelProps extends BaseProps {
  onPress: () => void;
  /** Obrigatorio quando tocavel: nao ha texto de botao para substituir. */
  accessibilityLabel: string;
}

type Props = BaseProps | TocavelProps;

function temOnPress(props: Props): props is TocavelProps {
  return 'onPress' in props && typeof props.onPress === 'function';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Sem sombra: hierarquia vem de espaco e divisoria, nao de elevacao forjada
// (anti-pattern, DESIGN.md secao 9 — mesma regra do ListRow).
export function Card(props: Props) {
  const scale = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(motion.press.scale, motion.press);
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.press);
  }, [scale]);

  if (!temOnPress(props)) {
    return <View style={[styles.base, props.style]}>{props.children}</View>;
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.base, props.style, animado]}
    >
      {props.children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    padding: space.lg,
  },
});
