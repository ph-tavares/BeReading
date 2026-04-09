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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBookWithChapters } from '../../src/api/queries';
import type { Book, Chapter } from '../../src/types/database';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<(Book & { chapters: Chapter[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBookWithChapters(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: unknown) => {
        if (!cancelled) setError('Não foi possível carregar o livro.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredScreen} edges={['top']}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.centeredScreen} edges={['top']}>
        <Text style={styles.errorEmoji}>😔</Text>
        <Text style={styles.errorText}>{error ?? 'Livro não encontrado'}</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sortedChapters = [...data.chapters].sort((a, b) => a.number - b.number);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Hero índigo com info do livro */}
      <View style={styles.hero}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backWrap}
        >
          <Text style={styles.backLink}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.bookTitle} numberOfLines={3}>
          {data.title}
        </Text>
        <Text style={styles.bookAuthor}>{data.author}</Text>
        <View style={styles.heroMeta}>
          {data.genre && (
            <View style={styles.genrePill}>
              <Text style={styles.genrePillText}>{data.genre}</Text>
            </View>
          )}
          <Text style={styles.pagesText}>{data.total_pages} páginas</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Seção de capítulos */}
        <Text style={styles.sectionLabel}>
          {sortedChapters.length}{' '}
          {sortedChapters.length === 1 ? 'Capítulo' : 'Capítulos'}
        </Text>

        {sortedChapters.length === 0 ? (
          <View style={styles.emptyChapters}>
            <Text style={styles.emptyChaptersText}>
              Capítulos ainda não disponíveis
            </Text>
          </View>
        ) : (
          /* Card com overflow:hidden para bordas arredondadas nos extremos */
          <View style={styles.chapterCard}>
            {sortedChapters.map((chapter, index) => (
              <TouchableOpacity
                key={chapter.id}
                style={[
                  styles.chapterRow,
                  index < sortedChapters.length - 1 && styles.chapterRowBorder,
                ]}
                onPress={() => router.push(`/quiz/${chapter.id}`)}
                activeOpacity={0.7}
              >
                {/* Número âmbar */}
                <View style={styles.chapterNumberWrap}>
                  <Text style={styles.chapterNumberText}>{chapter.number}</Text>
                </View>

                {/* Título + páginas */}
                <View style={styles.chapterInfo}>
                  {chapter.title ? (
                    <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  ) : (
                    <Text style={styles.chapterTitle}>
                      Capítulo {chapter.number}
                    </Text>
                  )}
                  <Text style={styles.chapterPages}>
                    p. {chapter.start_page}–{chapter.end_page}
                  </Text>
                </View>

                <Text style={styles.chapterArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  centeredScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Hero
  hero: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 6,
  },
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backLink: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  bookAuthor: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  genrePillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pagesText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
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

  // Seção
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Capítulos em card agrupado
  chapterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  chapterRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chapterNumberWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  chapterInfo: {
    flex: 1,
    gap: 2,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  chapterPages: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chapterArrow: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '600',
  },

  // Empty chapters
  emptyChapters: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyChaptersText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
