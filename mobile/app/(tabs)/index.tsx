import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { getStudentBooks, getStreak } from '../../src/api/queries';
import { StreakBadge } from '../../src/components/StreakBadge';
import { BookCard } from '../../src/components/BookCard';
import type { Streak, StudentBook, Book } from '../../src/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const { student } = useAuthStore();
  const { setCurrentBook } = useReadingStore();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [studentBooks, setStudentBooks] = useState<(StudentBook & { book: Book })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    setError(null);

    Promise.all([getStreak(student.id), getStudentBooks(student.id)])
      .then(([s, books]) => {
        setStreak(s);
        setStudentBooks(books);
        const reading = books.find((b) => b.status === 'reading') ?? books[0] ?? null;
        if (reading) setCurrentBook({ studentBook: reading, book: reading.book });
      })
      .catch(() => setError('Não foi possível carregar seus dados. Puxe para atualizar.'))
      .finally(() => setLoading(false));
  }, [student]);

  const currentEntry = studentBooks.find((sb) => sb.status === 'reading') ?? studentBooks[0];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header índigo */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <Text style={styles.name}>{student?.display_name ?? 'Leitor'} 👋</Text>
          </View>
          {streak && streak.current_streak > 0 && (
            <StreakBadge streak={streak.current_streak} dark />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Livro atual */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Lendo agora</Text>

          {currentEntry ? (
            <BookCard studentBook={currentEntry} book={currentEntry.book} />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📚</Text>
              <Text style={styles.emptyTitle}>Nenhum livro ainda</Text>
              <Text style={styles.emptySubtitle}>
                Visite o Catálogo e adicione um livro para começar
              </Text>
              <TouchableOpacity
                style={styles.catalogButton}
                onPress={() => router.push('/(tabs)/catalogo')}
                activeOpacity={0.8}
              >
                <Text style={styles.catalogButtonText}>Ver Catálogo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CTA principal */}
        {currentEntry && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/register-reading')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaEmoji}>📖</Text>
            <Text style={styles.ctaText}>Registrar Leitura</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  centered: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header índigo
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
    marginTop: 2,
  },

  // Scroll body
  scroll: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },

  // Error
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
  },

  // Section
  section: {
    gap: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
  },
  catalogButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
  },
  catalogButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    height: 56,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 4,
  },
  ctaEmoji: {
    fontSize: 18,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
