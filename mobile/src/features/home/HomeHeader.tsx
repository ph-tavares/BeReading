// Saudacao + anel de nivel da Hoje (spec S7.1, mockup 04). O anel leva para
// a aba Voce: o toque segue o mesmo feedback de mola do Button (motion.press),
// porque o Ring em si e' so desenho — quem o torna tocavel decide o estado de
// pressed (contrato documentado em DESIGN.md secao 5).
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from '../../ui/Text';
import { Ring } from '../../ui/Ring';
import { greeting } from '../../assistant/lines';
import { space, motion, hitSlop } from '../../theme/tokens';
import type { LevelInfo } from '../../game/xp';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  name: string;
  level: LevelInfo;
  onPressRing: () => void;
}

const RING_SIZE = 38; // Documentado em src/ui/Ring.tsx: 38 na Hoje.

export function HomeHeader({ name, level, onPressRing }: Props) {
  const scale = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(motion.press.scale, motion.press);
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.press);
  }, [scale]);

  const label = `Nível ${level.level}. Ver seu progresso em Você.`;

  return (
    <View style={styles.row}>
      <View>
        <Text variant="label" tone="secondary">{greeting()}</Text>
        <Text variant="title">{name}</Text>
      </View>
      {/* RING_SIZE (38) fica abaixo do alvo minimo de toque (44): hitSlop
          cobre a diferenca, exatamente a regra de DESIGN.md secao 4 pra
          elemento visual menor que MIN_TOUCH. */}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPressRing}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={hitSlop}
        style={animado}
      >
        {/* O Ring tem seu proprio no acessivel (progressbar + o mesmo rotulo);
            aninhado dentro de um botao com o mesmo texto, dois nos disputando
            o foco do leitor de tela. O rotulo pertence ao botao; esconde o
            Ring da arvore de acessibilidade, mesmo padrao do Glyph.tsx. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ring progress={level.progress} size={RING_SIZE} accessibilityLabel={label}>
            <Text variant="label">{level.level}</Text>
          </Ring>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
});
