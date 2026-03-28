import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { getStudentBooks } from '../../src/api/queries';
import { BookCard } from '../../src/components/BookCard';
import { sectionBooksByStatus } from '../../src/utils/bookUtils';
import type { StudentBook, Book } from '../../src/types/database';

export default function LivrosScreen() {
  const router = useRouter();
  const { student } = useAuthStore();
  const [books, setBooks] = useState<(StudentBook & { book: Book })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    setError(null);
    try {
      const data = await getStudentBooks(student.id);
      setBooks(data);
    } catch (e: unknown) {
      setError('Não foi possível carregar seus livros.');
    }
  }, [student]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const { reading, finished } = sectionBooksByStatus(books);
  const hasBooks = reading.length > 0 || finished.length > 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header índigo — mesmo padrão da Home */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Livros</Text>
        {hasBooks && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{books.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4F46E5"
          />
        }
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!hasBooks ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>Sua estante está vazia</Text>
            <Text style={styles.emptySubtitle}>
              Explore o Catálogo e adicione livros para começar
            </Text>
            <TouchableOpacity
              style={styles.catalogButton}
              onPress={() => router.push('/(tabs)/catalogo')}
              activeOpacity={0.8}
            >
              <Text style={styles.catalogButtonText}>Ver Catálogo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {reading.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Lendo agora</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{reading.length}</Text>
                  </View>
                </View>
                {reading.map((sb) => (
                  <View key={sb.id} style={styles.cardWrap}>
                    <BookCard studentBook={sb} book={sb.book} />
                  </View>
                ))}
              </View>
            )}

            {finished.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Finalizados</Text>
                  <View style={[styles.sectionBadge, styles.sectionBadgeGreen]}>
                    <Text style={[styles.sectionBadgeText, { color: '#059669' }]}>
                      {finished.length}
                    </Text>
                  </View>
                </View>
                {finished.map((sb) => (
                  <View key={sb.id} style={styles.cardWrap}>
                    <BookCard studentBook={sb} book={sb.book} />
                  </View>
                ))}
              </View>
            )}
          </>
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

  // Header
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },

  // Error
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sectionBadgeGreen: {
    backgroundColor: '#ECFDF5',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cardWrap: {
    marginBottom: 12,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  catalogButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  catalogButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
});
