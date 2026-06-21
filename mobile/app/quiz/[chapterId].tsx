import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Target, Wand, Sparkles, ArrowRight, Trophy, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { getQuestionsForChapter, getChapterQuizStatus } from '../../src/api/queries';
import { evaluateAnswer } from '../../src/api/edgeFunctions';
import { calcAverageScore } from '../../src/utils/quizUtils';
import { Press3DButton } from '../../src/components/Press3DButton';
import { XPPill } from '../../src/components/XPPill';
import { colors, fonts, radii } from '../../src/theme/tokens';
import type { Question } from '../../src/types/database';
import type { QuestionResult } from '../../src/utils/quizUtils';

type ScreenState = 'loading' | 'polling' | 'ready' | 'failed';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 4000;

export default function QuizScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [pollCount, setPollCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;

    async function load() {
      try {
        const status = await getChapterQuizStatus(chapterId!);
        if (cancelled) return;

        if (status?.status === 'generated') {
          const qs = await getQuestionsForChapter(chapterId!);
          if (cancelled) return;
          setQuestions(qs);
          setScreenState(qs.length > 0 ? 'ready' : 'failed');
        } else if (status?.status === 'failed') {
          setScreenState('failed');
        } else {
          setScreenState('polling');
        }
      } catch {
        if (!cancelled) setScreenState('failed');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [chapterId]);

  useEffect(() => {
    if (screenState !== 'polling') return;
    if (pollCount >= MAX_POLLS) {
      setScreenState('failed');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const status = await getChapterQuizStatus(chapterId!);
        if (cancelled) return;

        if (status?.status === 'generated') {
          const qs = await getQuestionsForChapter(chapterId!);
          if (cancelled) return;
          setQuestions(qs);
          setScreenState(qs.length > 0 ? 'ready' : 'failed');
        } else if (status?.status === 'failed') {
          setScreenState('failed');
        } else {
          setPollCount((c) => c + 1);
        }
      } catch {
        if (!cancelled) setPollCount((c) => c + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screenState, pollCount, chapterId]);

  async function handleSubmit() {
    if (!profile || !answer.trim() || evaluating) return;
    const q = questions[currentIndex];
    setEvaluating(true);
    try {
      const result = await evaluateAnswer(q.id, profile.user_id, answer.trim());
      setResults((prev) => ({ ...prev, [currentIndex]: result }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao avaliar resposta';
      Alert.alert('Erro', msg);
    } finally {
      setEvaluating(false);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnswer('');
    } else {
      const avg = calcAverageScore(Object.values(results));
      router.replace({
        pathname: '/quiz/summary',
        params: { avgScore: String(avg), total: String(questions.length) },
      });
    }
  }

  // States

  if (screenState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (screenState === 'polling') {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top + 60,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: colors.purple,
            borderBottomWidth: 4,
            borderBottomColor: colors.purpleDeep,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Sparkles size={32} color="#fff" strokeWidth={2.2} />
          </View>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 22,
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
            letterSpacing: -0.3,
          }}>Preparando seu quiz</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 15,
            color: colors.textSoft,
            textAlign: 'center',
            lineHeight: 22,
          }}>
            A IA está gerando perguntas{'\n'}sobre o capítulo que você leu
          </Text>
          <ActivityIndicator color={colors.purple} style={{ marginTop: 28 }} />
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 12,
            color: colors.textMute,
            marginTop: 12,
          }}>
            {pollCount > 3 ? 'Quase lá…' : 'Isso pode levar alguns instantes…'}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12, paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMute }}>
            Responder depois
          </Text>
        </Pressable>
      </View>
    );
  }

  if (screenState === 'failed' || questions.length === 0) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.bg,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😔</Text>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 20,
          color: colors.text,
          marginBottom: 8,
          textAlign: 'center',
        }}>Perguntas indisponíveis</Text>
        <Text style={{
          fontFamily: fonts.medium,
          fontSize: 14,
          color: colors.textMute,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 32,
        }}>
          Tente novamente mais tarde —{'\n'}estamos preparando seu quiz.
        </Text>
        <View style={{ width: '70%' }}>
          <Press3DButton onPress={() => router.back()}>Voltar</Press3DButton>
        </View>
      </View>
    );
  }

  const q = questions[currentIndex];
  const currentResult = results[currentIndex] ?? null;
  const submitted = currentResult != null;
  const isLast = currentIndex === questions.length - 1;
  const totalQ = questions.length;
  const isComprehension = q.type === 'comprehension';
  const typeColor = isComprehension ? colors.sky : colors.purple;
  const TypeIcon = isComprehension ? Target : Wand;
  const typeLabel = isComprehension ? 'Compreensão' : 'Reflexão';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header com HP bar */}
      <View style={{
        paddingTop: insets.top + 10,
        paddingHorizontal: 20,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}>
        <Pressable
          onPress={() => router.back()}
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
          <X size={18} color={colors.text} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: totalQ }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i < currentIndex ? colors.green : i === currentIndex ? colors.text : colors.surface,
              }}
            />
          ))}
        </View>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 12,
          color: colors.textMute,
          minWidth: 30,
          textAlign: 'right',
        }}>{currentIndex + 1}/{totalQ}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type pill */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: `${typeColor}22`,
          borderWidth: 1.5,
          borderColor: `${typeColor}55`,
          marginBottom: 22,
        }}>
          <TypeIcon size={14} color={typeColor} strokeWidth={2.4} />
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 11,
            color: typeColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>{typeLabel}</Text>
        </View>

        <Text style={{
          fontFamily: fonts.black,
          fontSize: 22,
          color: colors.text,
          lineHeight: 29,
          letterSpacing: -0.3,
          marginBottom: 28,
        }}>{q.question_text}</Text>

        {!submitted ? (
          <>
            <View style={{
              padding: 16,
              minHeight: 160,
              backgroundColor: colors.bgRaise,
              borderWidth: 1.5,
              borderColor: colors.hairline,
              borderRadius: radii.lg,
              marginBottom: 20,
            }}>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder="Escreve com suas palavras…"
                placeholderTextColor={colors.textMute}
                multiline
                style={{
                  minHeight: 128,
                  color: colors.text,
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  lineHeight: 22,
                  textAlignVertical: 'top',
                }}
              />
            </View>
            <Press3DButton
              onPress={handleSubmit}
              disabled={!answer.trim() || evaluating}
              Icon={CheckCheck}
              size="lg"
              color="purple"
            >
              {evaluating ? 'Avaliando…' : 'Enviar resposta'}
            </Press3DButton>
          </>
        ) : (
          <>
            {/* Sua resposta */}
            <View style={{
              padding: 14,
              marginBottom: 18,
              backgroundColor: colors.bgRaise,
              borderRadius: radii.md,
              borderLeftWidth: 3,
              borderLeftColor: colors.textDim,
            }}>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 13.5,
                color: colors.textSoft,
                fontStyle: 'italic',
                lineHeight: 20,
              }}>"{answer || q.question_text}"</Text>
            </View>

            {/* Score grande */}
            <View style={{
              padding: 20,
              marginBottom: 16,
              backgroundColor: colors.bgRaise,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: `${(currentResult?.score ?? 0) >= 85 ? colors.green : colors.gold}44`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 56,
                  color: (currentResult?.score ?? 0) >= 85 ? colors.green : colors.gold,
                  lineHeight: 56,
                  letterSpacing: -2,
                }}>{(currentResult?.score ?? 0)}</Text>
                <Text style={{
                  fontFamily: fonts.bold,
                  fontSize: 18,
                  color: colors.textMute,
                }}>/100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 11,
                  color: (currentResult?.score ?? 0) >= 85 ? colors.green : colors.gold,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  {(currentResult?.score ?? 0) >= 90 ? 'PERFEITO' : (currentResult?.score ?? 0) >= 85 ? 'EXCELENTE' : (currentResult?.score ?? 0) >= 70 ? 'MUITO BOM' : 'SEGUE ASSIM'}
                </Text>
                <XPPill xp={Math.round((currentResult?.score ?? 0) / 5)} />
              </View>
            </View>

            {/* Feedback */}
            <View style={{
              padding: 16,
              marginBottom: 24,
              backgroundColor: colors.bgRaise,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderLeftWidth: 3,
              borderLeftColor: colors.purple,
            }}>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 10.5,
                color: colors.purple,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>Feedback do mestre</Text>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: colors.textSoft,
                lineHeight: 21,
              }}>{currentResult!.feedback}</Text>
            </View>

            <Press3DButton onPress={handleNext} Icon={isLast ? Trophy : ArrowRight} size="lg">
              {isLast ? 'Ver recompensas' : 'Próxima'}
            </Press3DButton>
          </>
        )}
      </ScrollView>
    </View>
  );
}
