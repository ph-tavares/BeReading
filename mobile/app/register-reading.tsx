import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  type TextInput as TextInputType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { useReadingStore } from '../src/stores/readingStore';
import { registerReadingSession } from '../src/api/edgeFunctions';
import { validatePageRange } from '../src/utils/validation';

export default function RegisterReadingScreen() {
  const router = useRouter();
  const { student } = useAuthStore();
  const { currentBook } = useReadingStore();
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<TextInputType>(null);

  if (!currentBook || !student) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyText}>Nenhum livro selecionado</Text>
      </SafeAreaView>
    );
  }

  const { book } = currentBook;

  async function handleSubmit() {
    // Evita submit duplo via onSubmitEditing enquanto request está em voo
    if (loading) return;

    const start = parseInt(startPage, 10);
    const end = parseInt(endPage, 10);

    if (isNaN(start) || isNaN(end)) {
      Alert.alert('Páginas inválidas', 'Informe números de página válidos');
      return;
    }

    const validationError = validatePageRange(start, end, book.total_pages);
    if (validationError) {
      Alert.alert('Páginas inválidas', validationError);
      return;
    }

    setLoading(true);
    try {
      const result = await registerReadingSession(student.id, book.id, start, end);

      if (result.completed_chapter_ids.length > 0) {
        const chapterId = result.completed_chapter_ids[0];
        // TODO(task-9): rota /quiz/[chapterId] implementada na Task 9
        Alert.alert(
          '🎉 Capítulo completo!',
          `Você completou um capítulo de "${book.title}"!\n\nStreak: ${result.current_streak} dia${result.current_streak !== 1 ? 's' : ''} 🔥\n\nQuer responder as perguntas agora?`,
          [
            { text: 'Depois', style: 'cancel', onPress: () => router.back() },
            {
              text: 'Responder agora',
              // router.replace() em vez de back()+push() — evita race condition de navegação
              onPress: () => router.replace(`/quiz/${chapterId}`),
            },
          ],
        );
      } else {
        Alert.alert(
          '✅ Leitura registrada!',
          `Páginas ${start}–${end} registradas.\nStreak: ${result.current_streak} dia${result.current_streak !== 1 ? 's' : ''} 🔥`,
          [{ text: 'Ótimo!', onPress: () => router.back() }],
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente novamente';
      Alert.alert('Erro ao registrar', msg);
    } finally {
      setLoading(false);
    }
  }

  // Preview só exibe quando as páginas passam na mesma validação que handleSubmit
  const pagesRead = (() => {
    const s = parseInt(startPage, 10);
    const e = parseInt(endPage, 10);
    if (isNaN(s) || isNaN(e)) return null;
    if (validatePageRange(s, e, book.total_pages)) return null;
    return e - s + 1;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Voltar */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          {/* Cabeçalho do livro */}
          <View style={styles.bookHeader}>
            <View style={styles.bookIcon}>
              <Text style={styles.bookEmoji}>📖</Text>
            </View>
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
              <Text style={styles.bookMeta}>até a página {book.total_pages}</Text>
            </View>
          </View>

          <View style={styles.accentLine} />

          {/* Prompt */}
          <Text style={styles.prompt}>Qual foi sua leitura hoje?</Text>

          {/* Inputs lado a lado */}
          <View style={styles.pagesRow}>
            {/* Página inicial */}
            <View style={styles.pageField}>
              <TextInput
                style={styles.pageInput}
                value={startPage}
                onChangeText={setStartPage}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#D1D5DB"
                returnKeyType="next"
                onSubmitEditing={() => endRef.current?.focus()}
                maxLength={4}
              />
              <Text style={styles.pageLabel}>página inicial</Text>
            </View>

            {/* Seta âmbar */}
            <View style={styles.arrowWrap}>
              <View style={styles.arrowLine} />
              <Text style={styles.arrowHead}>›</Text>
            </View>

            {/* Página final */}
            <View style={styles.pageField}>
              <TextInput
                ref={endRef}
                style={styles.pageInput}
                value={endPage}
                onChangeText={setEndPage}
                keyboardType="number-pad"
                placeholder={String(book.total_pages)}
                placeholderTextColor="#D1D5DB"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                maxLength={4}
              />
              <Text style={styles.pageLabel}>página final</Text>
            </View>
          </View>

          {/* Preview de páginas lidas */}
          {pagesRead !== null && pagesRead > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewText}>
                <Text style={styles.previewCount}>{pagesRead}</Text>
                {` página${pagesRead !== 1 ? 's' : ''} hoje`}
              </Text>
            </View>
          )}

          {/* Botão */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonLoading]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Registrando…' : 'Registrar leitura'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },

  // Voltar
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '600',
  },

  // Cabeçalho do livro
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  bookIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexShrink: 0,
  },
  bookEmoji: {
    fontSize: 22,
  },
  bookInfo: {
    flex: 1,
    paddingTop: 2,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 22,
  },
  bookMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
  },

  accentLine: {
    width: 36,
    height: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 1,
    marginBottom: 24,
  },

  // Prompt
  prompt: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
    marginBottom: 28,
    lineHeight: 30,
  },

  // Inputs lado a lado
  pagesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
    marginBottom: 12,
  },
  pageField: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  pageInput: {
    width: '100%',
    height: 72,
    fontSize: 32,
    fontWeight: '800',
    color: '#4F46E5',
    textAlign: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'transparent',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  pageLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Seta
  arrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 4,
  },
  arrowLine: {
    width: 20,
    height: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 1,
  },
  arrowHead: {
    fontSize: 20,
    color: '#F59E0B',
    fontWeight: '700',
    lineHeight: 22,
    marginLeft: -2,
  },

  // Preview
  preview: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },

  // Botão
  button: {
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonLoading: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
