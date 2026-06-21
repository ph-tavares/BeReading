import { View, Text } from 'react-native';
import { Zap } from 'lucide-react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  xp: number;
}

export function XPPill({ xp }: Props) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.purple,
      borderBottomWidth: 2,
      borderBottomColor: colors.purpleDeep,
      alignSelf: 'flex-start',
    }}>
      <Zap size={12} color="#fff" fill="#fff" strokeWidth={2} />
      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 12 }}>
        +{xp}
      </Text>
    </View>
  );
}
