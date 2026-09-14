// src/components/QuizQuestionScreen.tsx
// BER-67: extraído de app/quiz/[chapterId].tsx — o fluxo de pergunta, resposta e
// resultado era o maior bloco do arquivo (header + corpo), sem estado próprio
// além do que já vinha de fora. Reposicionamento de JSX, sem mudança de
// comportamento ou aparência.
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Target, Wand, ArrowRight, Trophy, CheckCheck } from 'lucide-react-native';
import { Press3DButton } from './Press3DButton';
import { XPPill } from './XPPill';
import { colors, fonts, radii } from '../theme/tokens';
import type { Question } from '../types/database';
import type { QuestionResult } from '../utils/quizUtils';

interface QuizQuestionScreenProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  answer: string;
  onChangeAnswer: (text: string) => void;
  /** BER-48: texto que o leitor escreveu quando esta pergunta já tinha resposta salva. */
  submittedAnswerText?: string;
  evaluating: boolean;
  result: QuestionResult | null;
  onBack: () => void;
  onSubmit: () => void;
  onNext: () => void;
}

export function QuizQuestionScreen({
  question,
  currentIndex,
  totalQuestions,
  answer,
  onChangeAnswer,
  submittedAnswerText,
  evaluating,
  result,
  onBack,
  onSubmit,
  onNext,
}: QuizQuestionScreenProps) {
  const insets = useSafeAreaInsets();

  const submitted = result != null;
  const isLast = currentIndex === totalQuestions - 1;
  const isComprehension = question.type === 'comprehension';
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
          testID="quiz-question-back"
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
          <X size={18} color={colors.text} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: totalQuestions }).map((_, i) => (
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
        }}>{currentIndex + 1}/{totalQuestions}</Text>
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
        }}>{question.question_text}</Text>

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
                onChangeText={onChangeAnswer}
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
              onPress={onSubmit}
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
              }}>"{submittedAnswerText ?? answer}"</Text>
            </View>

            {/* BER-42: nota ausente NAO e nota zero. Enquanto a IA nao avaliou, a tela
                mostra o estado real em vez de um "0/100 - SEGUE ASSIM" desanimador
                ao lado de um feedback dizendo "avaliacao em breve". */}
            {result == null || result.score === null ? (
              <View style={{
                padding: 20,
                marginBottom: 16,
                backgroundColor: colors.bgRaise,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: `${colors.textMute}33`,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}>
                <ActivityIndicator size="small" color={colors.textMute} />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: fonts.black,
                    fontSize: 11,
                    color: colors.textMute,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>Avaliação em processamento</Text>
                  <Text style={{
                    fontFamily: fonts.bold,
                    fontSize: 13,
                    color: colors.textMute,
                  }}>Sua resposta foi salva. A nota aparece assim que a avaliação terminar.</Text>
                </View>
              </View>
            ) : (
              <View style={{
                padding: 20,
                marginBottom: 16,
                backgroundColor: colors.bgRaise,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: `${result.score >= 85 ? colors.green : colors.gold}44`,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{
                    fontFamily: fonts.black,
                    fontSize: 56,
                    color: result.score >= 85 ? colors.green : colors.gold,
                    lineHeight: 56,
                    letterSpacing: -2,
                  }}>{result.score}</Text>
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
                    color: result.score >= 85 ? colors.green : colors.gold,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>
                    {result.score >= 90 ? 'PERFEITO' : result.score >= 85 ? 'EXCELENTE' : result.score >= 70 ? 'MUITO BOM' : 'SEGUE ASSIM'}
                  </Text>
                  <XPPill xp={Math.round(result.score / 5)} />
                </View>
              </View>
            )}

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
              }}>{result!.feedback}</Text>
            </View>

            <Press3DButton onPress={onNext} Icon={isLast ? Trophy : ArrowRight} size="lg">
              {isLast ? 'Ver recompensas' : 'Próxima'}
            </Press3DButton>
          </>
        )}
      </ScrollView>
    </View>
  );
}
