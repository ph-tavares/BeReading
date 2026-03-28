import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ProgressBar } from './ProgressBar';
import type { StudentBook, Book } from '../types/database';

interface Props {
  studentBook: StudentBook;
  book: Book;
}

export function BookCard({ studentBook, book }: Props) {
  const router = useRouter();
  const progress = book.total_pages > 0 ? studentBook.current_page / book.total_pages : 0;
  const pct = Math.round(progress * 100);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/book/${book.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        {/* Capa */}
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverEmoji}>📖</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <View>
            <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
            <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
          </View>

          <View style={styles.progressArea}>
            <ProgressBar progress={progress} />
            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>
                Pág. {studentBook.current_page} / {book.total_pages}
              </Text>
              <Text style={styles.pct}>{pct}%</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  cover: {
    width: 60,
    height: 88,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 60,
    height: 88,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 26,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21,
  },
  author: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 3,
  },
  progressArea: {
    gap: 5,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  pct: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
});
