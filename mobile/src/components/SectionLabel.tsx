import { View, Text } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionLabel({ children, right }: Props) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12,
    }}>
      <Text style={{
        fontFamily: fonts.black,
        fontSize: 12,
        letterSpacing: 1.5,
        color: colors.textMute,
        textTransform: 'uppercase',
      }}>{children}</Text>
      {right}
    </View>
  );
}
