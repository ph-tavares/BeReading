import { View, Text } from 'react-native';
import { Flame } from 'lucide-react-native';
import { colors, fonts } from '../theme/tokens';
import { LottieSlot } from './LottieSlot';

interface Props {
  count: number;
  size?: 'md' | 'lg';
}

export function StreakPill({ count, size = 'md' }: Props) {
  const padH = size === 'lg' ? 14 : 11;
  const fz = size === 'lg' ? 18 : 14;
  const iconSize = size === 'lg' ? 24 : 18;
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: padH - 4,
      paddingRight: padH,
      paddingVertical: size === 'lg' ? 8 : 4,
      borderRadius: 999,
      backgroundColor: colors.flame,
      borderBottomWidth: 2,
      borderBottomColor: colors.flameDeep,
      alignSelf: 'flex-start',
    }}>
      <LottieSlot
        name="flame-streak"
        size={iconSize}
        fallback={<Flame size={iconSize} color="#fff" fill="#fff" strokeWidth={2} />}
      />
      <Text style={{ color: '#fff', fontFamily: fonts.black, fontSize: fz }}>
        {count}
      </Text>
    </View>
  );
}
