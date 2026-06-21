import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Medal } from 'lucide-react-native';
import { getScoreConfig } from '../../src/utils/quizUtils';
import { Press3DButton } from '../../src/components/Press3DButton';
import { XPPill } from '../../src/components/XPPill';
import { Card } from '../../src/components/Card';
import { LottieSlot } from '../../src/components/LottieSlot';
import { colors, fonts, radii } from '../../src/theme/tokens';

const R = 68;
const CIRCUM = 2 * Math.PI * R;

export default function QuizSummaryScreen() {
  const { avgScore, total } = useLocalSearchParams<{ avgScore: string; total: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const avg = parseInt(avgScore ?? '0', 10);
  const totalN = parseInt(total ?? '1', 10);
  const config = getScoreConfig(avg);
  const totalXP = Math.round((avg / 5) * totalN);
  const isExcellent = avg >= 85;
  const ringColor = isExcellent ? colors.green : colors.gold;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <LottieSlot name="confetti" size={280} loop={false} autoplay={false} fallback={null} />
      </View>

      <View style={{
        paddingTop: insets.top + 40,
        paddingHorizontal: 22,
        paddingBottom: 20,
        alignItems: 'center',
      }}>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 10.5,
          letterSpacing: 2.5,
          color: colors.textMute,
          marginBottom: 14,
        }}>QUEST COMPLETA</Text>

        <View style={{ width: 168, height: 168, marginBottom: 20 }}>
          <Svg width={168} height={168} viewBox="0 0 168 168" rotation={-90} originX={84} originY={84}>
            <Circle cx={84} cy={84} r={R} fill="none" stroke={colors.surface} strokeWidth={10} />
            <Circle
              cx={84}
              cy={84}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${(CIRCUM * avg) / 100} ${CIRCUM}`}
            />
          </Svg>
          <View style={{
            position: 'absolute',
            left: 0, right: 0, top: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{
              fontFamily: fonts.black,
              fontSize: 56,
              color: colors.text,
              lineHeight: 56,
              letterSpacing: -2,
            }}>{avg}</Text>
            <Text style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              color: colors.textMute,
              letterSpacing: 1.5,
              marginTop: 4,
            }}>/100 MÉDIA</Text>
          </View>
        </View>

        <Text style={{
          fontFamily: fonts.black,
          fontSize: 24,
          color: colors.text,
          letterSpacing: -0.4,
          marginBottom: 8,
        }}>{config.label}</Text>
        <Text style={{
          fontFamily: fonts.medium,
          fontSize: 13.5,
          color: colors.textSoft,
          lineHeight: 20,
          textAlign: 'center',
          maxWidth: 280,
          marginBottom: 18,
        }}>{totalN} de {totalN} respondidas. Sua compreensão subiu.</Text>

        <XPPill xp={totalXP} />
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 16 }}>
        {/* Badge unlocked (quando avg >= 85) */}
        {isExcellent && (
          <Card glow style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: colors.gold,
              borderBottomWidth: 4,
              borderBottomColor: colors.goldDeep,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Medal size={26} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 10.5,
                letterSpacing: 1.5,
                color: colors.gold,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}>Quest vencida</Text>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 15,
                color: colors.text,
              }}>Capítulo dominado</Text>
            </View>
          </Card>
        )}

        {/* Mensagem estilo "feedback do mestre" */}
        <View style={{
          backgroundColor: colors.bgRaise,
          borderRadius: radii.md,
          padding: 16,
          borderLeftWidth: 3,
          borderLeftColor: colors.purple,
        }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 10.5,
            letterSpacing: 1.5,
            color: colors.purple,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>Feedback do mestre</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 14,
            color: colors.textSoft,
            lineHeight: 21,
          }}>{config.message}</Text>
        </View>

        <Press3DButton onPress={() => router.replace('/')} size="lg">
          Continuar a saga
        </Press3DButton>
      </View>
    </View>
  );
}
