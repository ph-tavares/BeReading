import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { getQuestionsForChapter, getChapterQuizStatus } from '../../src/api/queries';
import { evaluateAnswer } from '../../src/api/edgeFunctions';
import { QuizQuestion } from '../../src/components/QuizQuestion';
import { calcAverageScore } from '../../src/utils/quizUtils';
import type { Question } from '../../src/types/database';
import type { QuestionResult } from '../../src/utils/quizUtils';

type ScreenState = 'loading' | 'polling' | 'ready' | 'failed';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 4000;

export default function QuizScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [pollCount, setPollCount] = useState(0);

  // Carga inicial: verifica status do quiz e carrega perguntas se disponíveis
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
          // pending ou null — inicia polling
          setScreenState('polling');
        }
      } catch (e: unknown) {
        if (!cancelled) setScreenState('failed');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [chapterId]);

  // Polling: aguarda IA gerar perguntas (max 10 tentativas × 4s = 40s)
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
      } catch (e: unknown) {
        // Erro de rede: incrementa contador e tenta novamente
        if (!cancelled) setPollCount((c) => c + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screenState, pollCount, chapterId]);

  async function handleAnswer(answer: string): Promise<void> {
    if (!profile) return;
    const q = questions[currentIndex];
    try {
      const result = await evaluateAnswer(q.id, profile.user_id, answer);
      setResults((prev) => ({ ...prev, [currentIndex]: result }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao avaliar resposta';
      Alert.alert('Erro', msg);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      const avg = calcAverageScore(Object.values(results));
      router.replace({
        pathname: '/quiz/summary',
        params: { avgScore: String(avg), total: String(questions.length) },
      });
    }
  }

  // --- Estados da tela ---

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  if (screenState === 'polling') {
    return (
      <SafeAreaView style={styles.pollingScreen}>
        <View style={styles.pollingContent}>
          <View style={styles.pollingIconWrap}>
            <Text style={styles.pollingEmoji}>✨</Text>
          </View>
          <Text style={styles.pollingTitle}>Preparando seu quiz</Text>
          <Text style={styles.pollingSubtitle}>
            {'A IA está gerando perguntas\nsobre o capítulo que você leu'}
          </Text>
          <ActivityIndicator color="#4F46E5" style={{ marginTop: 28 }} />
          <Text style={styles.pollingHint}>
            {pollCount > 3 ? 'Quase lá…' : 'Isso pode levar alguns instantes…'}
          </Text>
        </View>
        <TouchableOpacity style={styles.laterButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.laterText}>Responder depois</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (screenState === 'failed' || questions.length === 0) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <Text style={styles.failEmoji}>😔</Text>
        <Text style={styles.failTitle}>Perguntas indisponíveis</Text>
        <Text style={styles.failSubtitle}>
          {'Tente novamente mais tarde —\nestamos preparando seu quiz.'}
        </Text>
        <TouchableOpacity style={styles.failButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.failButtonText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentResult = results[currentIndex] ?? null;
  const isLast = currentIndex === questions.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.exitWrap}>
          <Text style={styles.exitLink}>← Sair</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quiz do capítulo</Text>
        <View style={styles.exitWrap} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <QuizQuestion
          key={currentIndex}
          questionText={currentQuestion.question_text}
          questionType={currentQuestion.type}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          onSubmit={handleAnswer}
          score={currentResult?.score ?? null}
          feedback={currentResult?.feedback ?? null}
        />

        {/* Botão "Próxima" — aparece após o resultado chegar */}
        {currentResult && (
          <View style={styles.nextWrap}>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.nextButtonText}>
                {isLast ? 'Ver resultado 🏆' : 'Próxima pergunta →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pollingScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  pollingContent: {
    alignItems: 'center',
  },
  pollingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pollingEmoji: {
    fontSize: 32,
  },
  pollingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  pollingSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  pollingHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
  },
  laterButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  laterText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Estado de falha
  failEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  failTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  failSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  failButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
  },
  failButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Header do quiz ativo
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  exitWrap: {
    width: 52,
  },
  exitLink: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.3,
  },

  // Botão próxima/resultado
  nextWrap: {
    paddingHorizontal: 28,
    marginTop: 8,
  },
  nextButton: {
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
