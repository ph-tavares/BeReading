// O menu do botão central (ADR 0016, substitui a 0014): o + abre um véu
// desfocado sobre o app e duas portas, "sessão de leitura" e "registrar
// leitura". O + gira e vira o X no mesmo lugar, então o dedo que abriu é o
// que fecha.
//
// Como o TabBar, este componente NÃO conhece rotas: quem monta passa as ações
// com o destino já resolvido (ver o cabeçalho de src/ui/TabBar.tsx).
import { useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Text } from './Text';
import { FAB_SIZE, TAB_BAR_HEIGHT } from './TabBar';
import { color, radius, space } from '../theme/tokens';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

export interface MenuAction {
  key: string;
  icon: IconCmp;
  title: string;
  description: string;
  /** A ação principal ganha o bloco de ícone em jade; as outras, neutro. */
  primary?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  actions: MenuAction[];
  onClose: () => void;
}

export function ActionMenu({ visible, title, actions, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const giro = useSharedValue(0);

  useEffect(() => {
    giro.value = withSpring(visible ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [visible, giro]);

  // Android: o voltar do sistema fecha o menu, e não a aba de trás.
  useEffect(() => {
    if (!visible) return;
    const inscricao = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => inscricao.remove();
  }, [visible, onClose]);

  // O + vira X girando 45 graus: é o mesmo desenho, então não há troca de ícone.
  const estiloGiro = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 45}deg` }] }));

  if (!visible) return null;

  // O X nasce exatamente em cima do +: mesma largura, e a mesma subida de
  // `space.xl` para fora da barra que o TabBar dá ao botão dele.
  const baseDoBotao = TAB_BAR_HEIGHT + insets.bottom + space.xl - FAB_SIZE;

  const escolher = (acao: MenuAction) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onClose();
    acao.onPress();
  };

  return (
    <View style={StyleSheet.absoluteFill} testID="action-menu">
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.veu]} />
        </Pressable>
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.pilha, { bottom: baseDoBotao + FAB_SIZE + space.xl }]}
      >
        <Animated.View entering={FadeInDown.duration(220)}>
          <Text variant="label" tone="secondary" align="center">{title}</Text>
        </Animated.View>
        {actions.map((acao, indice) => (
          <Animated.View
            key={acao.key}
            entering={FadeInDown.springify().damping(18).stiffness(200).delay(40 + indice * 50)}
            exiting={FadeOut.duration(120)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${acao.title}. ${acao.description}`}
              onPress={() => escolher(acao)}
              style={({ pressed }) => [styles.cartao, pressed ? styles.cartaoPressionado : null]}
            >
              <View style={[styles.icone, acao.primary ? styles.iconePrimario : null]}>
                <acao.icon
                  size={22}
                  color={acao.primary ? color.brandInk : color.text}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.textos}>
                <Text variant="subhead">{acao.title}</Text>
                <Text variant="caption" tone="tertiary">{acao.description}</Text>
              </View>
              <ChevronRight size={18} color={color.text3} strokeWidth={2} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <Pressable
        testID="action-menu-close"
        accessibilityRole="button"
        accessibilityLabel="Fechar menu"
        onPress={onClose}
        style={[styles.fechar, { bottom: baseDoBotao }]}
      >
        <Animated.View style={estiloGiro}>
          <Plus size={26} color={color.brandInk} strokeWidth={2.4} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // O blur sozinho clareia demais sobre o fundo escuro: o scrim do sistema
  // devolve o contraste para os cartões lerem por cima.
  veu: { backgroundColor: color.scrim },
  pilha: { position: 'absolute', left: space.gutter, right: space.gutter, gap: space.md },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: color.floating,
    borderWidth: 1,
    borderColor: color.line2,
  },
  cartaoPressionado: { backgroundColor: color.surface3, transform: [{ scale: 0.98 }] },
  icone: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface3,
  },
  iconePrimario: { backgroundColor: color.brand },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  fechar: {
    position: 'absolute',
    alignSelf: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.card,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
