import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { getBooks, addBookToReadingList, getStudentBooks } from '../../src/api/queries';
import type { Book } from '../../src/types/database';

export default function CatalogoScreen() {
  const { student } = useAuthStore();
  const [search, setSearch] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [myBookIds, setMyBookIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Carga inicial: todos os livros + livros já na lista do aluno
  useEffect(() => {
    if (!student) return;
    let cancelled = false;

    async function loadInitial() {
      try {
        const [allBooks, myBooks] = await Promise.all([
          getBooks(),
          getStudentBooks(student!.id),
        ]);
        if (cancelled) return;
        setBooks(allBooks);
        setMyBookIds(new Set(myBooks.map((sb) => sb.book_id)));
      } catch (e: unknown) {
        // Lista vazia em caso de erro — usuário pode puxar para atualizar
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => { cancelled = true; };
  }, [student]);

  // Busca debounced — 300ms após o usuário parar de digitar
  useEffect(() => {
    if (loading) return; // não dispara durante carga inicial
    const timer = setTimeout(async () => {
      try {
        const result = await getBooks(search || undefined);
        setBooks(result);
      } catch (e: unknown) {
        // Mantém lista atual em caso de erro de rede
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(book: Book) {
    if (!student || addingId) return;
    setAddingId(book.id);
    try {
      await addBookToReadingList(student.id, book.id);
      setMyBookIds((prev) => new Set([...prev, book.id]));
      Alert.alert('✅ Adicionado!', `"${book.title}" está na sua lista de leitura.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente novamente';
      Alert.alert('Erro', msg);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header índigo com campo de busca integrado */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catálogo</Text>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por título ou autor…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centeredBody}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {books.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nenhum livro encontrado</Text>
              {search.length > 0 && (
                <Text style={styles.emptySubtitle}>
                  Tente outro termo de busca
                </Text>
              )}
            </View>
          ) : (
            books.map((book) => {
              const added = myBookIds.has(book.id);
              const isAdding = addingId === book.id;
              return (
                <View key={book.id} style={styles.bookRow}>
                  {/* Capa placeholder */}
                  <View style={styles.coverPlaceholder}>
                    <Text style={styles.coverEmoji}>📖</Text>
                  </View>

                  {/* Informações */}
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookTitle} numberOfLines={2}>
                      {book.title}
                    </Text>
                    <Text style={styles.bookAuthor} numberOfLines={1}>
                      {book.author}
                    </Text>
                    {book.genre && (
                      <View style={styles.genreTag}>
                        <Text style={styles.genreText}>{book.genre}</Text>
                      </View>
                    )}
                  </View>

                  {/* Ação */}
                  {added ? (
                    <View style={styles.addedBadge}>
                      <Text style={styles.addedText}>✓</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addButton, isAdding && styles.addButtonLoading]}
                      onPress={() => handleAdd(book)}
                      disabled={!!addingId}
                      activeOpacity={0.8}
                    >
                      {isAdding ? (
                        <ActivityIndicator size="small" color="#4F46E5" />
                      ) : (
                        <Text style={styles.addButtonText}>+ Ler</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  centeredBody: {
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
    paddingBottom: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  clearIcon: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
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
    padding: 16,
    paddingBottom: 40,
  },

  // Book row
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  coverPlaceholder: {
    width: 44,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coverEmoji: {
    fontSize: 20,
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  bookAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  genreTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  genreText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
    letterSpacing: 0.3,
  },

  // Add/added state
  addedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '700',
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    flexShrink: 0,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonLoading: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
