import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowRight, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useReadingStore } from '../src/stores/readingStore';
import { registerReadingSession } from '../src/api/edgeFunctions';
import { validatePageRange } from '../src/utils/validation';
import { TopBar } from '../src/components/TopBar';
import { BookCover } from '../src/components/BookCover';
import { PageField } from '../src/components/PageField';
import { Card } from '../src/components/Card';
import { ProgressBar } from '../src/components/ProgressBar';
import { Press3DButton } from '../src/components/Press3DButton';
import { XPPill } from '../src/components/XPPill';
import { colors, fonts } from '../src/theme/tokens';

export default function RegisterReadingScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { currentBook } = useReadingStore();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  if (!currentBook || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMute, fontFamily: fonts.medium, fontSize: 15 }}>
          Nenhum livro selecionado
        </Text>
      </View>
    );
  }

  const { book } = currentBook;
  const { studentBook } = currentBook;

  const sNum = parseInt(start, 10);
  const eNum = parseInt(end, 10);
  const validationError =
    !isNaN(sNum) && !isNaN(eNum) ? validatePageRange(sNum, eNum, book.total_pages) : 'incompleto';
  const valid = !validationError;
  const pagesRead = valid ? eNum - sNum + 1 : null;
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

      if (result.completed_chapter_ids.length > 0) {
        const chapterId = result.completed_chapter_ids[0];
        Alert.alert(
          'Capítulo completo!',
          `Você completou um capítulo de "${book.title}"!\n\nStreak: ${result.current_streak} dia${result.current_streak !== 1 ? 's' : ''}\n\nQuer responder as perguntas agora?`,
          [
            { text: 'Depois', style: 'cancel', onPress: () => router.replace('/reading-success?pagesRead=' + (pagesRead ?? 0) + '&streak=' + result.current_streak) },
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
          </View>

          <Text style={{
            fontFamily: fonts.black,
            fontSize: 22,
            color: colors.text,
            letterSpacing: -0.4,
          }}>Até onde foi hoje?</Text>

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
