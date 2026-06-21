import { View, Text, Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function TopBar({ title, onBack, right }: Props) {
  return (
    <View style={{
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
    }}>
      {onBack && (
        <Pressable
          onPress={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: colors.bgRaise,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} color={colors.text} strokeWidth={2.2} />
        </Pressable>
      )}
      <Text style={{
        flex: 1,
        fontFamily: fonts.black,
        fontSize: 16,
        color: colors.text,
        textAlign: onBack ? 'left' : 'center',
        letterSpacing: 0.2,
      }}>{title}</Text>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}
