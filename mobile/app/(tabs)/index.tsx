import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Wand } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { ProfileErrorState } from '../../src/components/ProfileErrorState';
import { useReadingStore } from '../../src/stores/readingStore';
import { getStudentBooks, getStreak, loadPendingQuizzes } from '../../src/api/queries';
import { Card } from '../../src/components/Card';
import { StreakPill } from '../../src/components/StreakPill';
import { BookCover } from '../../src/components/BookCover';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Press3DButton } from '../../src/components/Press3DButton';
import { colors, fonts, radii } from '../../src/theme/tokens';
import type { Chapter, Streak, StudentBook, Book } from '../../src/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, profileStatus } = useAuthStore();
  const { currentBook, setCurrentBook } = useReadingStore();
  const [streak, setStreak] = useState<Streak | null>(null);
  // BER-54: quiz que ficou para depois nunca era lembrado.
  const [pendingQuizzes, setPendingQuizzes] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // BER-45: sem o setLoading(false) aqui, o `loading` inicial `true` nunca
      // virava false quando o perfil falhava — e a aba girava para sempre.
      if (!profile) { setLoading(false); return; }
      let cancelled = false;
      setError(null);

      Promise.all([getStreak(profile.user_id), getStudentBooks(profile.user_id)])
        .then(async ([s, books]) => {
          if (cancelled) return;
          setStreak(s);
          const raw = books.find((b) => b.status === 'reading') ?? books[0] ?? null;
          if (raw) {
            const { book, ...sb } = raw;
            setCurrentBook({ studentBook: sb, book });
          } else {
            setCurrentBook(null);
          }

          // BER-54: depois dos livros, porque precisa deles para saber até onde o
          // leitor chegou. Falhar aqui não derruba a Home — o card some, o resto fica.
          try {
            const pending = await loadPendingQuizzes(profile.user_id, books);
            if (!cancelled) setPendingQuizzes(pending);
          } catch {
            if (!cancelled) setPendingQuizzes([]);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setError('Não foi possível carregar seus dados. Puxe para atualizar.');
          setStreak(null);
          setPendingQuizzes([]);
          setCurrentBook(null);
        })
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }, [profile, setCurrentBook]),
  );

  const currentEntry = currentBook
    ? ({ ...currentBook.studentBook, book: currentBook.book } as StudentBook & { book: Book })
    : undefined;

  // BER-45: o perfil nao carregou. Antes isto era um spinner eterno.
  if (profileStatus === 'error') return <ProfileErrorState />;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const progress =
    currentEntry && currentEntry.book.total_pages > 0
      ? currentEntry.current_page / currentEntry.book.total_pages
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header saudação + streak */}
        <View style={{
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontFamily: fonts.semi, fontSize: 13, color: colors.textMute }}>
              Salve,
            </Text>
            <Text style={{
              fontFamily: fonts.black,
              fontSize: 26,
              color: colors.text,
              letterSpacing: -0.4,
            }}>{profile?.display_name ?? 'Leitor'} ✦</Text>
          </View>
          {streak && streak.current_streak > 0 && (
            <StreakPill count={streak.current_streak} size="lg" />
          )}
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          {error && (
            <View style={{
              backgroundColor: 'rgba(244,63,94,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(244,63,94,0.3)',
              borderRadius: radii.md,
              padding: 12,
            }}>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.rose,
                textAlign: 'center',
              }}>{error}</Text>
            </View>
          )}

          {/* Hype-Man card */}
          <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: 'rgba(250,204,21,0.1)',
                borderWidth: 1,
                borderColor: colors.hairline,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Image
                  source={require('../../assets/images/mascot.png')}
                  style={{ width: '110%', height: '110%' }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 10.5,
                  letterSpacing: 1.5,
                  color: colors.gold,
                  textTransform: 'uppercase',
                }}>Do dia</Text>
                <Text style={{
                  fontFamily: fonts.semi,
                  fontSize: 13.5,
                  color: colors.text,
                  lineHeight: 19,
                  marginTop: 3,
                }}>
                  "Quem lê atravessa mundos sem sair do sofá. Bora pra próxima página?"
                </Text>
              </View>
            </View>
          </Card>

          {/* Current book hero ou empty */}
          {currentEntry ? (
            <Card onPress={() => router.push(`/book/${currentEntry.book.id}`)} style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <BookCover book={currentEntry.book} size="md" glow />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontFamily: fonts.black,
                    fontSize: 10.5,
                    letterSpacing: 1.5,
                    color: colors.green,
                    textTransform: 'uppercase',
                  }}>Lendo agora</Text>
                  <Text numberOfLines={2} style={{
                    fontFamily: fonts.black,
                    fontSize: 18,
                    color: colors.text,
                    marginTop: 4,
                    letterSpacing: -0.2,
                    lineHeight: 21,
                  }}>{currentEntry.book.title}</Text>
                  <Text numberOfLines={1} style={{
                    fontFamily: fonts.medium,
                    fontSize: 12,
                    color: colors.textMute,
                    marginTop: 2,
                  }}>{currentEntry.book.author}</Text>
                  <View style={{ marginTop: 14 }}>
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}>
                      <Text style={{
                        fontFamily: fonts.semi,
                        fontSize: 11,
                        color: colors.textMute,
                      }}>
                        pág. {currentEntry.current_page}/{currentEntry.book.total_pages}
                      </Text>
                      <Text style={{
                        fontFamily: fonts.black,
                        fontSize: 14,
                        color: colors.green,
                      }}>{Math.round(progress * 100)}%</Text>
                    </View>
                    <ProgressBar progress={progress} height={10} />
                  </View>
                </View>
              </View>
            </Card>
          ) : (
            <Card style={{ padding: 28, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 36 }}>📚</Text>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 16,
                color: colors.text,
              }}>Nenhum livro ainda</Text>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.textMute,
                textAlign: 'center',
              }}>
                Visite o Catálogo e adicione um livro para começar
              </Text>
              <View style={{ marginTop: 8, width: '70%' }}>
                <Press3DButton onPress={() => router.push('/(tabs)/catalogo')} Icon={Compass}>
                  Ver Catálogo
                </Press3DButton>
              </View>
            </Card>
          )}

          {/* BER-54: aqui ficavam dois MiniStat com valores fixos no código —
              "XP hoje +0" e "Tempo lendo 0min". Nenhuma das duas métricas existe
              no produto: o app não mede tempo de leitura e não tem XP diário.
              Mostrar número inventado é pior do que não mostrar nada. Saíram; o
              espaço agora é do quiz que ficou esperando, que era código morto. */}
          {pendingQuizzes.length > 0 && (
            <Card style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Wand size={20} color={colors.purple} strokeWidth={2.4} />
                <Text style={{
                  fontFamily: fonts.black,
                  fontSize: 16,
                  color: colors.text,
                  letterSpacing: -0.2,
                }}>
                  {pendingQuizzes.length === 1
                    ? 'Um quiz esperando por você'
                    : `${pendingQuizzes.length} quizzes esperando por você`}
                </Text>
              </View>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: colors.textSoft,
                lineHeight: 20,
              }}>
                Você terminou o capítulo {pendingQuizzes[0].number} e ainda não respondeu.
              </Text>
              <Press3DButton
                onPress={() => router.push(`/quiz/${pendingQuizzes[0].id}`)}
                Icon={Wand}
                color="purple"
              >
                Responder agora
              </Press3DButton>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
