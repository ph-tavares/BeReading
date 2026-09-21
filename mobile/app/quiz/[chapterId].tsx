import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useEntitlementStore } from '../../src/stores/entitlementStore';
import {
  isQuotaExceededError,
  paywallCopy,
  quizQuotaFor,
  type QuotaExceeded,
} from '../../src/utils/billing';
import {
  getChapterQuizStatus,
  getStudentAnswersForChapter,
  loadQuizForReader,
} from '../../src/api/queries';
import { resultsFromExistingAnswers } from '../../src/utils/quizAnswers';
import { evaluateAnswer } from '../../src/api/edgeFunctions';
import { calcAverageScore, countPendingEvaluations } from '../../src/utils/quizUtils';
import { Screen, Skeleton, useToast } from '../../src/ui';
import { AssistantStateView, QuizConversation } from '../../src/features/quiz-chat';
import type { QuizStateKey } from '../../src/assistant/lines';
import { radius, space } from '../../src/theme/tokens';
import type { Question, QuizGrounding } from '../../src/types/database';
import type { QuestionResult } from '../../src/utils/quizUtils';
import { pollDelayMs, shouldKeepPolling } from '../../src/utils/quizPolling';
import { quizScreenStateFor } from '../../src/utils/quizStatus';

// F5 (BER-77): a apresentacao virou conversa com a Orelha (src/features/quiz-chat).
// A maquina de estados abaixo e a do time e continua identica: carga com cota,
// polling, resposta imutavel (409), cota no envio (402) e recarga ao voltar dos
// planos.
//
// BER-40: 'still-generating' NAO e 'failed'. Esgotar a janela de espera significa
// "ainda nao ficou pronto", nao "deu erro", e a diferenca aparece na tela.
// BER-66: 'no-content' tambem NAO e 'failed'. O capitulo nao tem texto cadastrado,
// entao nao ha o que re-tentar, e mentir ("deu erro") esconde o motivo real.
// BER-58: 'quota' tambem NAO e 'failed'. O leitor usou os quizzes do mes no plano
// gratuito, e a tela convida para o Premium em vez de dizer que deu erro.
type ScreenState =
  | 'loading' | 'polling' | 'ready' | 'failed' | 'still-generating' | 'no-content' | 'quota';

export default function QuizScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuthStore();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [pollCount, setPollCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  // BER-48: o texto que o leitor escreveu em cada pergunta já respondida.
  const [answerTexts, setAnswerTexts] = useState<Record<number, string>>({});
  const [quota, setQuota] = useState<QuotaExceeded | null>(null);
  // BER-59: de onde veio o conteúdo das perguntas, gravado pelo generate-questions.
  const [grounding, setGrounding] = useState<QuizGrounding | null>(null);
  // Recarrega o quiz quando o leitor volta da tela de planos (assinou ou não).
  const [reloadKey, setReloadKey] = useState(0);
  const screenStateRef = useRef(screenState);
  screenStateRef.current = screenState;

  useFocusEffect(
    useCallback(() => {
      if (screenStateRef.current === 'quota') setReloadKey((k) => k + 1);
    }, []),
  );

  /** Perguntas carregadas: o quiz abre mostrando o que já foi respondido (BER-48). */
  function applyLoaded({ questions: qs, progress }: Awaited<ReturnType<typeof loadQuizForReader>>) {
    setQuestions(qs);
    setResults(progress.results);
    setAnswerTexts(progress.answerTexts);
    setCurrentIndex(progress.startIndex);
    setScreenState(qs.length > 0 ? 'ready' : 'failed');
  }

  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;

    async function load() {
      try {
        // BER-58: sem cota no mês, o quiz de um capítulo novo nem abre. O leitor
        // vê o convite antes de escrever uma resposta que o servidor recusaria.
        // Se o plano não carregar, segue: a trava de verdade é o evaluate-answer.
        const [status, entitlement] = await Promise.all([
          getChapterQuizStatus(chapterId!),
          useEntitlementStore.getState().refresh(),
        ]);
        if (cancelled) return;

        const blocked = entitlement ? quizQuotaFor(entitlement, chapterId!) : null;
        if (blocked) {
          setQuota(blocked);
          setScreenState('quota');
          return;
        }

        const next = quizScreenStateFor(status);
        if (next === 'ready') {
          const loaded = await loadQuizForReader(chapterId!, profile?.user_id);
          if (cancelled) return;
          setGrounding(status?.grounding ?? null);
          applyLoaded(loaded);
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
  }, [chapterId, reloadKey]);

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
          const loaded = await loadQuizForReader(chapterId!, profile?.user_id);
          if (cancelled) return;
          setGrounding(status?.grounding ?? null);
          applyLoaded(loaded);
        } else if (next === 'polling') {
          setPollCount((c) => c + 1);
        } else {
          // 'failed' ou 'no-content' (BER-66): parar de esperar, os dois sao finais.
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
      if (result.alreadyAnswered) {
        // BER-48: a pergunta já tinha resposta (outro aparelho, toque duplo). Vale a
        // avaliação que ficou no servidor: recarrega as respostas do capítulo.
        const answers = await getStudentAnswersForChapter(profile.user_id, chapterId!);
        const progress = resultsFromExistingAnswers(questions, answers);
        setResults(progress.results);
        setAnswerTexts(progress.answerTexts);
      } else {
        setResults((prev) => ({ ...prev, [currentIndex]: result }));
        setAnswerTexts((prev) => ({ ...prev, [currentIndex]: answer.trim() }));
      }
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        setQuota(e.quota);
        setScreenState('quota');
        return;
      }
      // Toast no lugar do Alert.alert (spec secao 8). O texto digitado fica no
      // composer, e o leitor manda de novo quando quiser.
      toast.show({
        message: 'Não deu pra enviar sua resposta.',
        detail: 'O que você escreveu continua aqui.',
        tone: 'danger',
      });
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
          // BER-42: sem nota nenhuma, manda vazio em vez de "0": a tela distingue
          // "ainda avaliando" de "tirou zero".
          avgScore: avg === null ? '' : String(avg),
          total: String(questions.length),
          pending: String(pending),
          // F5: o resumo usa o capitulo para o titulo, o recap e "Rever a conversa".
          chapterId: chapterId ?? '',
        },
      });
    }
  }

  function estado(state: QuizStateKey, detail: string, onPrimary?: () => void) {
    return (
      <Screen scroll={false} edges={['top', 'bottom']} contentStyle={styles.centro}>
        <AssistantStateView
          state={state}
          chapterNumber={null}
          detail={detail}
          onPrimary={onPrimary}
          onBack={() => router.back()}
        />
      </Screen>
    );
  }

  if (screenState === 'loading') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']} onBack={() => router.back()} title="Quiz" contentStyle={styles.carregando}>
        <Skeleton width="72%" height={96} borderRadius={radius.card} />
        <Skeleton width="48%" height={48} borderRadius={radius.card} />
      </Screen>
    );
  }

  if (screenState === 'quota' && quota) {
    const copy = paywallCopy(quota);
    return estado(
      'quota',
      copy.hint ? `${copy.description} ${copy.hint}` : copy.description,
      () => router.push('/planos'),
    );
  }

  if (screenState === 'polling') {
    return estado('polling', pollCount > 3 ? 'Quase lá.' : 'Leva uns instantes.');
  }

  if (screenState === 'still-generating') {
    return estado('still-generating', 'Pode fechar e voltar depois.', () => {
      setPollCount(0);
      setScreenState('polling');
    });
  }

  // BER-66: o capitulo nao tem texto cadastrado em book_contents. Nao e falha da IA
  // e nao adianta re-tentar: o que falta e conteudo. A tela diz isso, em vez de
  // "deu erro", e nao oferece um botao que sabidamente nao resolve.
  if (screenState === 'no-content') {
    return estado('no-content', 'Sua leitura continua contando pra sua sequência.');
  }

  if (screenState === 'failed' || questions.length === 0) {
    return estado('failed', 'Se continuar assim, tenta mais tarde.', () => {
      setScreenState('loading');
      setReloadKey((k) => k + 1);
    });
  }

  return (
    <QuizConversation
      questions={questions}
      currentIndex={currentIndex}
      results={results}
      answerTexts={answerTexts}
      answer={answer}
      onChangeAnswer={setAnswer}
      evaluating={evaluating}
      onSubmit={handleSubmit}
      onNext={handleNext}
      onBack={() => router.back()}
      grounding={grounding}
    />
  );
}

const styles = StyleSheet.create({
  carregando: { gap: space.md, paddingTop: space.lg },
  centro: { flexGrow: 1, justifyContent: 'center' },
});
