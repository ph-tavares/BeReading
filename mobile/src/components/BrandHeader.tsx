import { View, Text } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { colors, fonts } from '../theme/tokens';

export function BrandHeader() {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}>
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: colors.green,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.green,
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
      }}>
        <BookOpen size={16} color="#fff" strokeWidth={2.6} />
      </View>
      <Text style={{
        fontFamily: fonts.black,
        fontSize: 17,
        color: colors.text,
        letterSpacing: -0.3,
      }}>BeReading</Text>
    </View>
  );
}
