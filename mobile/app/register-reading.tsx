import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowRight, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useReadingStore } from '../src/stores/readingStore';
import { registerReadingSession } from '../src/api/edgeFunctions';
import { getStudentBooks } from '../src/api/queries';
import { validatePageRange } from '../src/utils/validation';
import {
  pagesAlreadyRead,
  pickInitialBook,
  summarizeCompletedChapters,
  toChoices,
  type BookChoice,
} from '../src/utils/registerReading';
import { TopBar } from '../src/components/TopBar';
import { BookCover } from '../src/components/BookCover';
import { PageField } from '../src/components/PageField';
import { Card } from '../src/components/Card';
import { ProgressBar } from '../src/components/ProgressBar';
import { Press3DButton } from '../src/components/Press3DButton';
import { XPPill } from '../src/components/XPPill';
import { colors, fonts, radii } from '../src/theme/tokens';

export default function RegisterReadingScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { currentBook } = useReadingStore();
  // BER-44: o livro pode vir por parametro (ex.: a partir da tela do livro).
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const [choices, setChoices] = useState<BookChoice[]>([]);
  const [selected, setSelected] = useState<BookChoice | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [picking, setPicking] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  // BER-44: a tela dependia de `currentBook`, que so a Home setava — e sempre com
  // o PRIMEIRO livro em leitura. Quem le dois nao registrava o segundo, e se a
  // Home tivesse falhado o FAB abria uma tela sem saida. Agora a lista vem daqui.
  useEffect(() => {
    if (!profile) {
      setLoadingBooks(false);
      return;
    }
    let cancelled = false;

    getStudentBooks(profile.user_id)
      .then((rows) => {
        if (cancelled) return;
        const list = toChoices(rows);
        setChoices(list);
        setSelected(pickInitialBook(list, bookId ?? currentBook?.book.id ?? null));
      })
      .catch(() => {
        // Sem lista, a tela ainda oferece o livro que a Home tinha aberto.
        if (!cancelled && currentBook) setSelected(currentBook);
      })
      .finally(() => {
        if (!cancelled) setLoadingBooks(false);
      });

    return () => { cancelled = true; };
  }, [profile, bookId, currentBook]);

  if (loadingBooks) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Registrar leitura" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </View>
    );
  }

  // BER-44: antes isto era um texto solto no meio da tela, sem TopBar e sem
  // nenhum jeito de sair a nao ser fechar o app.
  if (!selected || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Registrar leitura" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 20,
            color: colors.text,
            textAlign: 'center',
            letterSpacing: -0.3,
          }}>Nenhum livro em andamento</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 15,
            color: colors.textSoft,
            textAlign: 'center',
            lineHeight: 22,
          }}>
            Escolha um livro no catálogo para começar a registrar suas leituras.
          </Text>
          <Press3DButton onPress={() => router.replace('/(tabs)/catalogo')}>
            Ver catálogo
          </Press3DButton>
        </View>
      </View>
    );
  }

  const { book, studentBook } = selected;

  const sNum = parseInt(start, 10);
  const eNum = parseInt(end, 10);
  const validationError =
    !isNaN(sNum) && !isNaN(eNum) ? validatePageRange(sNum, eNum, book.total_pages) : 'incompleto';
  const valid = !validationError;
  const pagesRead = valid ? eNum - sNum + 1 : null;
  // BER-54: paginas relidas entram de novo na contagem — `pages_read` e coluna
  // gerada no banco, entao a correcao de verdade depende de migration (BER-31).
  // O que da para fazer agora e a pessoa saber antes de enviar.
  const repetidas = valid ? pagesAlreadyRead(sNum, eNum, studentBook.current_page) : 0;
  const progressNow = valid
    ? eNum / book.total_pages
    : book.total_pages > 0
      ? studentBook.current_page / book.total_pages
      : 0;

  async function handleSubmit() {
    if (loading || !profile || !valid) return;

    setLoading(true);
    try {
      const result = await registerReadingSession(profile.user_id, book.id, sNum, eNum);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // BER-54: a tela pegava completed_chapter_ids[0] e falava em "um capítulo",
      // mesmo quando a sessão tinha fechado dois ou três. O quiz ainda abre um de
      // cada vez; os outros ficam pendentes e a Home lembra.
      const { count, firstChapterId } = summarizeCompletedChapters(result.completed_chapter_ids);

      if (firstChapterId) {
        const chapterId = firstChapterId;
        const capitulos = count === 1
          ? `Você completou um capítulo de "${book.title}"!`
          : `Você completou ${count} capítulos de "${book.title}"!`;
        const perguntas = count === 1
          ? 'Quer responder as perguntas agora?'
          : 'Quer começar pelas perguntas do primeiro? Os outros ficam esperando na tela inicial.';
        Alert.alert(
          count === 1 ? 'Capítulo completo!' : 'Capítulos completos!',
          `${capitulos}\n\nStreak: ${result.current_streak} dia${result.current_streak !== 1 ? 's' : ''}\n\n${perguntas}`,
          [
            {
              text: 'Depois',
              style: 'cancel',
              // Params como objeto: tipado pelo Expo Router e escapa os valores,
              // ao contrário da query string concatenada à mão.
              onPress: () =>
                router.replace({
                  pathname: '/reading-success',
                  params: { pagesRead: pagesRead ?? 0, streak: result.current_streak },
                }),
            },
            { text: 'Responder agora', onPress: () => router.replace(`/quiz/${chapterId}`) },
          ],
        );
      } else {
        router.replace({
          pathname: '/reading-success',
          params: { pagesRead: String(pagesRead ?? 0), streak: String(result.current_streak) },
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente novamente';
      Alert.alert('Erro ao registrar', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Registrar leitura" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 30, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <BookCover book={book} size="sm" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{
                fontFamily: fonts.black,
                fontSize: 16,
                color: colors.text,
                letterSpacing: -0.2,
                lineHeight: 19,
              }}>{book.title}</Text>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: colors.textMute,
                marginTop: 2,
              }}>
                {book.author} · {book.total_pages} pág.
              </Text>
            </View>

            {/* BER-44: com mais de um livro em andamento, da para trocar aqui.
                Antes, o livro era sempre o que a Home tinha escolhido. */}
            {choices.length > 1 && (
              <Pressable
                testID="trocar-livro"
                onPress={() => setPicking((p) => !p)}
                hitSlop={8}
                style={{ paddingVertical: 6, paddingHorizontal: 10 }}
              >
                <Text style={{ fontFamily: fonts.black, fontSize: 13, color: colors.green }}>
                  {picking ? 'Fechar' : 'Trocar'}
                </Text>
              </Pressable>
            )}
          </View>

          {picking && (
            <Card style={{ padding: 8 }}>
              {choices.map((choice) => {
                const isSelected = choice.book.id === book.id;
                return (
                  <Pressable
                    key={choice.book.id}
                    onPress={() => {
                      setSelected(choice);
                      setPicking(false);
                      setStart('');
                      setEnd('');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: isSelected ? colors.surface2 : 'transparent',
                    }}
                  >
                    <BookCover book={choice.book} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{
                        fontFamily: isSelected ? fonts.black : fonts.bold,
                        fontSize: 14,
                        color: colors.text,
                        lineHeight: 18,
                      }}>{choice.book.title}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMute, marginTop: 2 }}>
                        pág. {choice.studentBook.current_page} de {choice.book.total_pages}
                      </Text>
                    </View>
                    {isSelected && <CheckCheck size={18} color={colors.green} strokeWidth={2.4} />}
                  </Pressable>
                );
              })}
            </Card>
          )}

          <Text style={{
            fontFamily: fonts.black,
            fontSize: 22,
            color: colors.text,
            letterSpacing: -0.4,
          }}>Até onde foi hoje?</Text>

          {repetidas > 0 && (
            <View style={{
              backgroundColor: 'rgba(250,204,21,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(250,204,21,0.3)',
              borderRadius: radii.md,
              padding: 12,
            }}>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 13,
                color: colors.gold,
                lineHeight: 19,
              }}>
                {repetidas === 1
                  ? 'Uma página desse intervalo você já tinha registrado antes.'
                  : `${repetidas} páginas desse intervalo você já tinha registrado antes.`}
                {' '}Seu progresso está na página {studentBook.current_page}.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <PageField label="Início" value={start} onChange={setStart} placeholder="—" />
            <View style={{ paddingBottom: 32 }}>
              <ArrowRight size={22} color={colors.green} strokeWidth={2.4} />
            </View>
            <PageField label="Fim" value={end} onChange={setEnd} placeholder={String(book.total_pages)} />
          </View>

          <Card style={{ padding: 18 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 12,
            }}>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 44,
                color: valid ? colors.green : colors.textDim,
                lineHeight: 44,
                letterSpacing: -1.5,
              }}>{pagesRead ?? '—'}</Text>
              <Text style={{
                fontFamily: fonts.bold,
                fontSize: 13,
                color: colors.textMute,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>páginas</Text>
              <View style={{ flex: 1 }} />
              {valid && pagesRead != null && <XPPill xp={pagesRead * 5} />}
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <Text style={{
                fontFamily: fonts.bold,
                fontSize: 10.5,
                color: colors.textMute,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>Progresso do livro</Text>
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 11,
                color: colors.green,
              }}>{Math.round(progressNow * 100)}%</Text>
            </View>
            <ProgressBar progress={progressNow} height={12} />
          </Card>

          <Press3DButton
            onPress={handleSubmit}
            disabled={!valid || loading}
            Icon={CheckCheck}
            size="lg"
          >
            {loading
              ? 'Registrando…'
              : valid
                ? `Registrar ${pagesRead} página${pagesRead !== 1 ? 's' : ''}`
                : 'Informe as páginas'}
          </Press3DButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
