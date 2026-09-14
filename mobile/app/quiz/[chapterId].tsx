import { useEffect, useState } from 'react';
import { View, Alert, ActivityIndicator, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Sparkles, BookOpen } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { getQuestionsForChapter, getChapterQuizStatus } from '../../src/api/queries';
import { evaluateAnswer } from '../../src/api/edgeFunctions';
import { calcAverageScore, countPendingEvaluations } from '../../src/utils/quizUtils';
import { Press3DButton } from '../../src/components/Press3DButton';
import { QuizMessageScreen, QuizMessageIconBadge } from '../../src/components/QuizMessageScreen';
import { QuizQuestionScreen } from '../../src/components/QuizQuestionScreen';
import { colors, fonts } from '../../src/theme/tokens';
import type { Question } from '../../src/types/database';
import type { QuestionResult } from '../../src/utils/quizUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pollDelayMs, shouldKeepPolling } from '../../src/utils/quizPolling';
import { quizScreenStateFor } from '../../src/utils/quizStatus';

// BER-40: 'still-generating' NAO e 'failed'. Esgotar a janela de espera significa
// "ainda nao ficou pronto", nao "deu erro" — e a diferenca aparece na tela.
// BER-66: 'no-content' tambem NAO e 'failed'. O capitulo nao tem texto cadastrado,
// entao nao ha o que re-tentar — e mentir ("deu erro") esconde o motivo real.
type ScreenState =
  | 'loading' | 'polling' | 'ready' | 'failed' | 'still-generating' | 'no-content';

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

        const next = quizScreenStateFor(status);
        if (next === 'ready') {
          const qs = await getQuestionsForChapter(chapterId!);
          if (cancelled) return;
          setQuestions(qs);
          setScreenState(qs.length > 0 ? 'ready' : 'failed');
        } else {
          // 'polling', 'failed' ou 'no-content' (BER-66).
          setScreenState(next);
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
    if (!shouldKeepPolling(pollCount)) {
      // A geracao pode continuar no servidor; o que acabou foi a nossa espera.
      setScreenState('still-generating');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const status = await getChapterQuizStatus(chapterId!);
        if (cancelled) return;

        const next = quizScreenStateFor(status);
        if (next === 'ready') {
          const qs = await getQuestionsForChapter(chapterId!);
          if (cancelled) return;
          setQuestions(qs);
          setScreenState(qs.length > 0 ? 'ready' : 'failed');
        } else if (next === 'polling') {
          setPollCount((c) => c + 1);
        } else {
          // 'failed' ou 'no-content' (BER-66) — parar de esperar, os dois sao finais.
          setScreenState(next);
        }
      } catch {
        if (!cancelled) setPollCount((c) => c + 1);
      }
    }, pollDelayMs(pollCount));

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
      const all = Object.values(results);
      const avg = calcAverageScore(all);
      const pending = countPendingEvaluations(all);
      router.replace({
        pathname: '/quiz/summary',
        params: {
          // BER-42: sem nota nenhuma, manda vazio em vez de "0" — a tela distingue
          // "ainda avaliando" de "tirou zero".
          avgScore: avg === null ? '' : String(avg),
          total: String(questions.length),
          pending: String(pending),
        },
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
      <QuizMessageScreen
        paddingTop={insets.top + 60}
        paddingBottom={insets.bottom + 40}
        icon={
          <QuizMessageIconBadge background={colors.purple} borderColor={colors.purpleDeep}>
            <Sparkles size={32} color="#fff" strokeWidth={2.2} />
          </QuizMessageIconBadge>
        }
        title="Preparando seu quiz"
        description={'A IA está gerando perguntas\nsobre o capítulo que você leu'}
        extra={
          <>
            <ActivityIndicator color={colors.purple} style={{ marginTop: 28 }} />
            <Text style={{
              fontFamily: fonts.medium,
              fontSize: 12,
              color: colors.textMute,
              marginTop: 12,
            }}>
              {pollCount > 3 ? 'Quase lá…' : 'Isso pode levar alguns instantes…'}
            </Text>
          </>
        }
      >
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 12, paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMute }}>
            Responder depois
          </Text>
        </Pressable>
      </QuizMessageScreen>
    );
  }

  if (screenState === 'still-generating') {
    return (
      <QuizMessageScreen
        paddingTop={insets.top + 60}
        paddingBottom={insets.bottom + 40}
        icon={
          <QuizMessageIconBadge background={colors.purple} borderColor={colors.purpleDeep}>
            <Sparkles size={32} color="#fff" strokeWidth={2.2} />
          </QuizMessageIconBadge>
        }
        title="Seu quiz ainda está sendo preparado"
        description="Está demorando mais que o normal, mas as perguntas continuam sendo geradas. Volte em alguns minutos — sua leitura já está registrada."
      >
        <View style={{ width: '100%', gap: 8 }}>
          <Pressable
            onPress={() => { setPollCount(0); setScreenState('polling'); }}
            style={{ paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.black, fontSize: 15, color: colors.purple }}>
              Verificar de novo
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMute }}>
              Responder depois
            </Text>
          </Pressable>
        </View>
      </QuizMessageScreen>
    );
  }

  // BER-66: o capitulo nao tem texto cadastrado em book_contents. Nao e falha da IA
  // e nao adianta re-tentar — o que falta e conteudo. A tela diz isso, em vez de
  // "deu erro", e nao oferece um botao que sabidamente nao resolve.
  if (screenState === 'no-content') {
    return (
      <QuizMessageScreen
        paddingTop={insets.top + 60}
        paddingBottom={insets.bottom + 40}
        icon={
          <QuizMessageIconBadge background={colors.surface} borderColor={colors.surface2}>
            <BookOpen size={32} color={colors.textSoft} strokeWidth={2.2} />
          </QuizMessageIconBadge>
        }
        title="Ainda não temos este capítulo"
        description="Sem o conteúdo do capítulo, qualquer pergunta que a gente fizesse seria chute — e preferimos não fazer isso. Sua leitura já está registrada e continua contando para a sua sequência."
      >
        <View style={{ width: '100%', gap: 8 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.black, fontSize: 15, color: colors.purple }}>
              Voltar para o livro
            </Text>
          </Pressable>
        </View>
      </QuizMessageScreen>
    );
  }

  if (screenState === 'failed' || questions.length === 0) {
    return (
      <QuizMessageScreen
        justify="center"
        paddingTop={32}
        paddingBottom={32}
        icon={<Text style={{ fontSize: 48, marginBottom: 16 }}>😔</Text>}
        title="Perguntas indisponíveis"
        titleSize={20}
        titleMarginBottom={8}
        description={'Tente novamente mais tarde —\nestamos preparando seu quiz.'}
        descriptionSize={14}
        descriptionMarginBottom={32}
      >
        <View style={{ width: '70%' }}>
          <Press3DButton onPress={() => router.back()}>Voltar</Press3DButton>
        </View>
      </QuizMessageScreen>
    );
  }

  return (
    <QuizQuestionScreen
      question={questions[currentIndex]}
      currentIndex={currentIndex}
      totalQuestions={questions.length}
      answer={answer}
      onChangeAnswer={setAnswer}
      evaluating={evaluating}
      result={results[currentIndex] ?? null}
      onBack={() => router.back()}
      onSubmit={handleSubmit}
      onNext={handleNext}
    />
  );
}
