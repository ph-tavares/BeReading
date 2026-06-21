import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Plus, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { getBooks, addBookToReadingList, getStudentBooks } from '../../src/api/queries';
import { BookCover } from '../../src/components/BookCover';
import { Chip } from '../../src/components/Chip';
import { SectionLabel } from '../../src/components/SectionLabel';
import { CATEGORIES, categoryOf } from '../../src/theme/categories';
import { coverFromId } from '../../src/theme/bookCover';
import { colors, fonts, radii } from '../../src/theme/tokens';
import type { Book } from '../../src/types/database';

export default function CatalogoScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [myBookIds, setMyBookIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function loadInitial() {
      try {
        const [allBooks, myBooks] = await Promise.all([
          getBooks(),
          getStudentBooks(profile!.user_id),
        ]);
        if (cancelled) return;
        setBooks(allBooks);
        setMyBookIds(new Set(myBooks.map((sb) => sb.book_id)));
      } catch {
        // lista vazia
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await getBooks(search || undefined);
        if (!cancelled) setBooks(result);
      } catch {
        // mantém lista atual em caso de erro
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, loading]);

  async function handleAdd(book: Book) {
    if (!profile || addingId) return;
    setAddingId(book.id);
    try {
      await addBookToReadingList(profile.user_id, book.id);
      setMyBookIds((prev) => new Set([...prev, book.id]));
      Alert.alert('Adicionado!', `"${book.title}" está na sua lista de leitura.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente novamente';
      Alert.alert('Erro', msg);
    } finally {
      setAddingId(null);
    }
  }

  const filtered = books.filter((b) => {
    if (cat === 'all') return true;
    const c = categoryOf(b.genre);
    return c?.id === cat;
  });

  const selectedCat = CATEGORIES.find((c) => c.id === cat);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 28,
            color: colors.text,
            letterSpacing: -0.5,
          }}>Explorar</Text>
          <Text style={{
            fontFamily: fonts.semi,
            fontSize: 13,
            color: colors.textMute,
            marginTop: 2,
          }}>Encontre sua próxima aventura</Text>

          {/* Search */}
          <View style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            height: 52,
            backgroundColor: colors.bgRaise,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.hairline,
          }}>
            <Search size={18} color={colors.textMute} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Busque por título ou autor…"
              placeholderTextColor={colors.textMute}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                color: colors.text,
                fontFamily: fonts.medium,
                fontSize: 14,
              }}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={colors.textMute} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Categorias */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 8,
          }}
        >
          <Chip active={cat === 'all'} onPress={() => setCat('all')} color={colors.text}>
            Todos
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={cat === c.id}
              onPress={() => setCat(c.id)}
              color={c.color}
              Icon={c.Icon}
            >
              {c.label}
            </Chip>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20 }}>
          <SectionLabel>
            {cat === 'all' ? 'Todos os livros' : selectedCat?.label ?? 'Livros'}
          </SectionLabel>

          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={{
                fontFamily: fonts.bold,
                fontSize: 15,
                color: colors.textSoft,
                marginTop: 12,
              }}>Nenhum livro encontrado</Text>
              {search.length > 0 && (
                <Text style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.textMute,
                  marginTop: 4,
                }}>Tente outro termo de busca</Text>
              )}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {filtered.map((b) => {
                const added = myBookIds.has(b.id);
                const { color, deep } = coverFromId(b.id);
                return (
                  <View key={b.id} style={{ width: '47%', marginBottom: 10 }}>
                    <View style={{ aspectRatio: 0.7, marginBottom: 10 }}>
                      <BookCover
                        book={b}
                        size="md"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                    <Text numberOfLines={2} style={{
                      fontFamily: fonts.black,
                      fontSize: 13,
                      color: colors.text,
                      lineHeight: 16,
                    }}>{b.title}</Text>
                    <Text numberOfLines={1} style={{
                      fontFamily: fonts.semi,
                      fontSize: 11,
                      color: colors.textMute,
                      marginTop: 2,
                    }}>{b.author}</Text>
                    <Pressable
                      onPress={() => handleAdd(b)}
                      disabled={added || addingId === b.id}
                      style={({ pressed }) => ({
                        marginTop: 10,
                        height: 38,
                        borderRadius: 14,
                        backgroundColor: added ? `${color}22` : color,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        borderBottomWidth: added ? 0 : 3,
                        borderBottomColor: deep,
                        opacity: pressed && !added ? 0.85 : 1,
                      })}
                    >
                      {addingId === b.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : added ? (
                        <>
                          <CheckCheck size={13} color={color} strokeWidth={3} />
                          <Text style={{ fontFamily: fonts.black, fontSize: 12, color }}>
                            Na estante
                          </Text>
                        </>
                      ) : (
                        <>
                          <Plus size={14} color="#fff" strokeWidth={2.6} />
                          <Text style={{ fontFamily: fonts.black, fontSize: 12, color: '#fff' }}>
                            Começar
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
