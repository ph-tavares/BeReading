import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Home, BookOpen, Library, Compass, User } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme/tokens';

const BAR_H = 72;
const NOTCH_W = 92;
const NOTCH_D = 30;
const FAB = 62;
const FAB_TOP = -12;

interface TabDef {
  name: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const LEFT: TabDef[] = [
  { name: 'index',  label: 'Início',  Icon: Home },
  { name: 'livros', label: 'Estante', Icon: Library },
];
const RIGHT: TabDef[] = [
  { name: 'catalogo', label: 'Explorar', Icon: Compass },
  { name: 'perfil',   label: 'Perfil',   Icon: User },
];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const cx = W / 2;
  const nL = cx - NOTCH_W / 2;
  const nR = cx + NOTCH_W / 2;
  const barPath = [
    `M 0 0`,
    `L ${nL} 0`,
    `C ${nL + NOTCH_W * 0.18} 0, ${cx - NOTCH_W * 0.36} ${NOTCH_D}, ${cx} ${NOTCH_D}`,
    `C ${cx + NOTCH_W * 0.36} ${NOTCH_D}, ${nR - NOTCH_W * 0.18} 0, ${nR} 0`,
    `L ${W} 0`,
    `L ${W} ${BAR_H}`,
    `L 0 ${BAR_H}`,
    'Z',
  ].join(' ');

  const activeName = state.routes[state.index]?.name;

  const renderItem = (t: TabDef) => {
    const on = activeName === t.name;
    const tint = on ? colors.green : colors.textMute;
    return (
      <Pressable
        key={t.name}
        onPress={() => navigation.navigate(t.name as never)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <View style={{
          width: 40,
          height: 28,
          borderRadius: 12,
          backgroundColor: on ? 'rgba(34,197,94,0.1)' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <t.Icon size={20} color={tint} strokeWidth={on ? 2.4 : 2} />
        </View>
        <Text style={{ color: tint, fontFamily: fonts.bold, fontSize: 10.5 }}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: colors.bg }}>
      <View style={{ position: 'relative', height: BAR_H }}>
        <Svg width={W} height={BAR_H} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Path d={barPath} fill={colors.bgSunk} stroke={colors.hairline} strokeWidth={1} />
        </Svg>

        {/* Abas esquerda + direita */}
        <View style={{
          position: 'absolute',
          left: 0, right: 0, top: 0, height: BAR_H,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {LEFT.map(renderItem)}
          </View>
          <View style={{ width: NOTCH_W }} />
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {RIGHT.map(renderItem)}
          </View>
        </View>

        {/* Hitbox wrapper: delimita a área de toque a 52×52px. */}
        <View
          style={{
            position: 'absolute',
            left: cx - FAB / 2,
            top: FAB_TOP,
            width: FAB,
            height: FAB,
          }}
        >
          {/* Círculo verde — View puro garante que backgroundColor
            * é pintado independente de como o renderer trata o Pressable. */}
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: FAB / 2,
              backgroundColor: colors.green,
              borderBottomWidth: 5,
              borderBottomColor: colors.greenDeep,
              shadowColor: colors.greenDeep,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: 5,
            }}
          />
          {/* Pressable transparente: captura toques e centraliza ícone. */}
          <Pressable
            testID="fab-registrar"
            onPress={() => router.push('/register-reading')}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={22} color="#fff" strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>

      </View>

      {/* Safe area fill */}
      <View style={{ height: 28, backgroundColor: colors.bgSunk }} />
    </View>
  );
}
