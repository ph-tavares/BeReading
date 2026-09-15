// Hoje (spec S7.1, mockup 04): a primeira tela redesenhada do app. Ordem:
// saudacao + anel de nivel -> semana de sequencia + frase -> hero do livro em
// leitura -> acao primaria "Registrar leitura" -> card do assistente
// (condicional) -> fileira "Tambem lendo" (2+ livros) -> linha de nivel/XP.
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { useProgressStore } from '../../src/stores/progressStore';
import { ProfileErrorState } from '../../src/components/ProfileErrorState';
import {
  getStudentBooks, loadPendingQuizzes, getBookWithChapters, getQuestionsForChapter,
} from '../../src/api/queries';
import { Screen, Button, Banner } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { effectiveStreak, weekDays } from '../../src/game/streak';
import { streakLine, streakRiskLine, pendingQuizLine, staleBookLine } from '../../src/assistant/lines';
import {
  HomeHeader, StreakWeek, CurrentBookHero, AlsoReadingRow, AssistantCard, LevelFooter,
  HomeSkeleton, HomeEmptyState, currentChapterGoal, daysSinceLastSession, readSessionToday,
  chooseAssistantReason,
} from '../../src/features/home';
import type { Book, Chapter, StudentBook } from '../../src/types/database';

type Entry = StudentBook & { book: Book };

/**
 * O quiz pendente e a contagem de perguntas so fazem sentido juntos: um
 * capitulo sem contagem confiavel nao e "quiz pendente com zero perguntas",
 * e' "ainda nao sei". Por isso um estado so, atribuido de uma vez so depois
 * das duas consultas voltarem — nunca dois `useState` que a tela possa ler
 * em momentos diferentes (achado critico da revisao da Tarefa 4: um deles
 * podia zerar sem o outro, e a tela escrevia "deixou 0 perguntas pra tras").
 */
interface PendingQuiz {
  chapterId: string;
  chapterNumber: number;
  questionCount: number;
}

const SEM_STREAK = { current_streak: 0, last_read_date: null as string | null };

export default function HomeScreen() {
  const router = useRouter();
  const { profile, profileStatus } = useAuthStore();
  const { setCurrentBook } = useReadingStore();
  const { xp, level, streak, sessions, refresh: refreshProgress } = useProgressStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Entry[] | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [pendingQuiz, setPendingQuiz] = useState<PendingQuiz | null>(null);

  const load = useCallback(async (userId: string) => {
    setError(null);
    try {
      const [entries] = await Promise.all([
        getStudentBooks(userId),
        refreshProgress(userId),
      ]);
      setBooks(entries);

      const lendo = entries.filter((e) => e.status === 'reading');
      const atual = lendo[0] ?? entries[0] ?? null;
      setCurrentBook(atual ? { studentBook: atual, book: atual.book } : null);

      if (atual) {
        try {
          const withChapters = await getBookWithChapters(atual.book.id);
          setChapters(withChapters?.chapters ?? null);
        } catch {
          setChapters(null);
        }
      } else {
        setChapters(null);
      }

      // BER-54: falhar aqui nao derruba a tela, so o card do assistente some.
      // As duas consultas (capitulos pendentes e contagem de perguntas) so
      // viram estado JUNTAS, no fim: qualquer falha no meio devolve null, o
      // card some, e nao um numero pela metade.
      try {
        const pendentes = await loadPendingQuizzes(userId, entries);
        if (pendentes.length === 0) {
          setPendingQuiz(null);
        } else {
          const perguntas = await getQuestionsForChapter(pendentes[0].id);
          setPendingQuiz({
            chapterId: pendentes[0].id,
            chapterNumber: pendentes[0].number,
            questionCount: perguntas.length,
          });
        }
      } catch {
        setPendingQuiz(null);
      }
    } catch {
      // Erro (banner): o que ja carregou (books, chapters, progressStore)
      // fica como estava, ninguem zera nada aqui.
      setError('Não foi possível carregar seus dados. Puxe para atualizar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshProgress, setCurrentBook]);

  useFocusEffect(
    useCallback(() => {
      // BER-45: sem este early return, o `loading` inicial nunca vira false
      // quando o perfil falha, e a aba gira para sempre.
      if (!profile) { setLoading(false); return; }
      load(profile.user_id);
    }, [profile, load]),
  );

  const onRefresh = useCallback(() => {
    if (!profile) return Promise.resolve();
    setRefreshing(true);
    return load(profile.user_id);
  }, [profile, load]);

  if (profileStatus === 'error') return <ProfileErrorState />;

  if (!profile || loading) {
    return (
      <Screen contentStyle={styles.content}>
        <HomeSkeleton />
      </Screen>
    );
  }

  const banner = error ? <Banner tone="danger" message={error} onRetry={onRefresh} /> : null;
  const header = (
    <HomeHeader
      name={profile.display_name}
      level={level}
      onPressRing={() => router.push('/(tabs)/perfil')}
    />
  );

  // Sem carga bem-sucedida nenhuma ainda (so acontece com erro na primeira
  // tentativa: o banner acima ja explica). Nao ha "atual" pra derivar nada.
  if (books === null) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
        {banner}
        {header}
      </Screen>
    );
  }

  if (books.length === 0) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
        {banner}
        {header}
        <HomeEmptyState onExplore={() => router.push('/(tabs)/catalogo')} />
      </Screen>
    );
  }

  // Daqui pra baixo, books.length > 0: sempre ha um livro atual, sem
  // precisar tratar `atual` como possivelmente nulo de novo (a checagem
  // condicional redundante era um ramo morto apontado na revisao).
  const lendo = books.filter((e) => e.status === 'reading');
  const atual: Entry = lendo[0] ?? books[0];
  const outros = lendo.filter((e) => e.book.id !== atual.book.id);

  const meta = chapters ? currentChapterGoal(chapters, atual.current_page) : null;

  const streakEfetiva = effectiveStreak(streak ?? SEM_STREAK);
  const leuHoje = readSessionToday(sessions);

  const motivo = chooseAssistantReason({
    pendingQuiz,
    streak: streakEfetiva,
    readToday: leuHoje,
    staleDays: daysSinceLastSession(sessions, atual.book.id),
  });

  let assistantText: string | null = null;
  let assistantCta: { label: string; onPress: () => void } | null = null;
  if (motivo?.kind === 'quiz') {
    assistantText = pendingQuizLine(motivo.chapterNumber, motivo.questionCount);
    assistantCta = { label: 'Responder agora', onPress: () => router.push(`/quiz/${motivo.chapterId}`) };
  } else if (motivo?.kind === 'streakRisk') {
    assistantText = streakRiskLine(motivo.hoursLeft);
  } else if (motivo?.kind === 'stale') {
    assistantText = staleBookLine(motivo.days);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
      {banner}
      {header}
      <StreakWeek days={weekDays(sessions)} streakText={streakLine(streakEfetiva, leuHoje)} />

      <CurrentBookHero
        book={atual.book}
        currentPage={atual.current_page}
        goal={meta}
        onPress={() => router.push(`/book/${atual.book.id}`)}
      />
      <Button icon={BookOpen} onPress={() => router.push('/register-reading')}>
        Registrar leitura
      </Button>

      {assistantText ? (
        <AssistantCard
          text={assistantText}
          ctaLabel={assistantCta?.label}
          onPressCta={assistantCta?.onPress}
        />
      ) : null}

      {outros.length > 0 ? (
        <AlsoReadingRow
          books={outros.map((e) => ({
            id: e.book.id, title: e.book.title, author: e.book.author, cover_url: e.book.cover_url,
          }))}
          onPressBook={(id) => router.push(`/book/${id}`)}
        />
      ) : null}

      <LevelFooter level={level} xp={xp} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, gap: space.xxl },
});
