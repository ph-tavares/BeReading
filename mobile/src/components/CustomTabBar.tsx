import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Home, BookOpen, Library, Compass, User } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme/tokens';

const BAR_H = 72;
const NOTCH_W = 92;
const NOTCH_D = 30;
const FAB = 64;
// Quanto o FAB protrude visualmente acima do topo da barra.
const PROTRUSION = FAB / 2 - 8; // 24px

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

  // O container tem altura total = protuberância + barra + safe area.
  // pointerEvents="box-none": o espaço transparente acima da barra (onde o FAB
  // protrude) não captura toques — apenas os Pressable filhos capturam os seus.
  // O FAB fica em top:0 desse container (sem top negativo), então sua hitbox
  // é exatamente o círculo verde, sem sangrar para o conteúdo da tela acima.
  return (
    <View
      style={{ height: PROTRUSION + BAR_H + 28, backgroundColor: 'transparent' }}
      pointerEvents="box-none"
    >
      {/* Fundo SVG — deslocado para baixo por PROTRUSION, deixando espaço pro FAB */}
      <Svg
        width={W}
        height={BAR_H}
        style={{ position: 'absolute', top: PROTRUSION, left: 0 }}
      >
        <Path d={barPath} fill={colors.bgSunk} stroke={colors.hairline} strokeWidth={1} />
      </Svg>

      {/* Safe area fill */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 28,
        backgroundColor: colors.bgSunk,
      }} />

      {/* Abas esquerda + direita */}
      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: PROTRUSION,
        height: BAR_H,
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

      {/* Label "Registrar" */}
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          top: PROTRUSION + BAR_H - 18,
          color: colors.green,
          fontFamily: fonts.black,
          fontSize: 10.5,
          letterSpacing: 0.3,
        }}
      >Registrar</Text>

      {/* FAB central — top:0, sem negativo. Hitbox = exatamente o círculo. */}
      <Pressable
        testID="fab-registrar"
        onPress={() => router.push('/register-reading')}
        style={({ pressed }) => ({
          position: 'absolute',
          left: cx - FAB / 2,
          top: 0,
          width: FAB,
          height: FAB,
          borderRadius: FAB / 2,
          backgroundColor: colors.green,
          // Bordas individuais explícitas evitam conflitos de shorthand.
          borderTopWidth: 4,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderBottomWidth: pressed ? 4 : 10,
          borderTopColor: colors.bgSunk,
          borderLeftColor: colors.bgSunk,
          borderRightColor: colors.bgSunk,
          borderBottomColor: colors.greenDeep,
          shadowColor: colors.greenDeep,
          shadowOffset: { width: 0, height: pressed ? 0 : 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: pressed ? 0 : 6,
          transform: [{ translateY: pressed ? 5 : 0 }],
        })}
      >
        {/*
         * View absolutamente posicionada garante centralização do ícone
         * independente de como o Pressable processa alignItems/justifyContent
         * em diferentes versões do React Native.
         */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOpen size={28} color="#fff" strokeWidth={2.2} />
        </View>
      </Pressable>
    </View>
  );
}
