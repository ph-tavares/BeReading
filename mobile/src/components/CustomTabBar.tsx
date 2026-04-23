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

  // pointerEvents="box-none": o container em si não captura toques — apenas os
  // Pressable filhos capturam as suas próprias áreas. Isso faz com que a área
  // transparente (onde o FAB protrude acima da barra) não bloqueie a tela de
  // conteúdo. A altura é BAR_H + 28 (o que o framework de navegação espera).
  // O fundo transparente + tabBarStyle no layout remove o branco padrão do framework.
  return (
    <View
      style={{ backgroundColor: 'transparent' }}
      pointerEvents="box-none"
    >
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

        {/* Label "Registrar" */}
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0, right: 0,
            textAlign: 'center',
            top: BAR_H - 18,
            color: colors.green,
            fontFamily: fonts.black,
            fontSize: 10.5,
            letterSpacing: 0.3,
          }}
        >Registrar</Text>

        {/* FAB central.
          * top: -FAB/2+8 faz o círculo protudir visualmente acima da barra.
          * O container pai tem pointerEvents="box-none", portanto apenas o
          * próprio Pressable captura toques — não o espaço transparente ao redor.
          * O ícone fica em View absolutamente posicionada para garantir
          * centralização independente do comportamento do Pressable em cada RN. */}
        <Pressable
          testID="fab-registrar"
          onPress={() => router.push('/register-reading')}
          style={({ pressed }) => ({
            position: 'absolute',
            left: cx - FAB / 2,
            top: -FAB / 2 + 8,
            width: FAB,
            height: FAB,
            borderRadius: FAB / 2,
            backgroundColor: colors.green,
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
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={28} color="#fff" strokeWidth={2.2} />
          </View>
        </Pressable>
      </View>

      {/* Safe area fill */}
      <View style={{ height: 28, backgroundColor: colors.bgSunk }} />
    </View>
  );
}
