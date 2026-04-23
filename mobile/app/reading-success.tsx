import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { colors, fonts } from '../src/theme/tokens';
import { Press3DButton } from '../src/components/Press3DButton';
import { LottieSlot } from '../src/components/LottieSlot';
import { XPPill } from '../src/components/XPPill';
import { StreakPill } from '../src/components/StreakPill';

export default function ReadingSuccessScreen() {
  const router = useRouter();
  const { pagesRead = '0', streak = '0' } = useLocalSearchParams<{ pagesRead?: string; streak?: string }>();
  const pr = Number(pagesRead) || 0;
  const st = Number(streak) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '20%',
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <LottieSlot name="confetti" size={220} loop={false} autoplay={false} fallback={null} />
      </View>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 100,
          alignItems: 'center',
        }}
      >
        <View style={{
          width: 88,
          height: 88,
          borderRadius: 30,
          backgroundColor: colors.green,
          borderBottomWidth: 8,
          borderBottomColor: colors.greenDeep,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          shadowColor: colors.green,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 24,
          elevation: 10,
        }}>
          <Check size={44} color="#fff" strokeWidth={3} />
        </View>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 28,
          color: colors.text,
          letterSpacing: -0.5,
          marginBottom: 8,
        }}>+{pr} página{pr !== 1 ? 's' : ''}</Text>
        <Text style={{
          fontFamily: fonts.medium,
          fontSize: 14,
          color: colors.textSoft,
          marginBottom: 16,
        }}>Streak de {st} dia{st !== 1 ? 's' : ''} aceso.</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
          <XPPill xp={pr * 5} />
          <StreakPill count={st} />
        </View>
        <View style={{ width: '100%' }}>
          <Press3DButton onPress={() => router.replace('/(tabs)/')} size="lg">
            Voltar ao início
          </Press3DButton>
        </View>
      </View>
    </View>
  );
}
