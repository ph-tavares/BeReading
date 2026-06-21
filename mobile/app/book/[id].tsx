import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { getBookWithChapters } from '../../src/api/queries';
import { TopBar } from '../../src/components/TopBar';
import { BookCover } from '../../src/components/BookCover';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Press3DButton } from '../../src/components/Press3DButton';
import { colors, fonts, radii } from '../../src/theme/tokens';
import { categoryOf } from '../../src/theme/categories';
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
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o livro.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Livro" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>😔</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 15,
            color: colors.textSoft,
            textAlign: 'center',
            marginBottom: 20,
          }}>{error ?? 'Livro não encontrado'}</Text>
          <View style={{ width: '60%' }}>
            <Press3DButton onPress={() => router.back()}>Voltar</Press3DButton>
          </View>
        </View>
      </View>
    );
  }

  const sortedChapters = [...data.chapters].sort((a, b) => a.number - b.number);
  const category = categoryOf(data.genre);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Livro" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero com capa + info */}
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 8 }}>
          <BookCover book={data} size="lg" glow />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{
              fontFamily: fonts.black,
              fontSize: 22,
              color: colors.text,
              letterSpacing: -0.3,
              textAlign: 'center',
              lineHeight: 27,
            }}>{data.title}</Text>
            <Text style={{
              fontFamily: fonts.semi,
              fontSize: 14,
              color: colors.textMute,
            }}>{data.author}</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: 4,
            }}>
              {category && (
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: `${category.color}22`,
                  borderWidth: 1,
                  borderColor: `${category.color}55`,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  <category.Icon size={12} color={category.color} strokeWidth={2.4} />
                  <Text style={{
                    fontFamily: fonts.black,
                    fontSize: 10.5,
                    color: category.color,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}>{category.label}</Text>
                </View>
              )}
              <Text style={{
                fontFamily: fonts.semi,
                fontSize: 12,
                color: colors.textMute,
              }}>{data.total_pages} páginas</Text>
            </View>
          </View>
        </View>

        {/* Capítulos */}
        <View>
          <SectionLabel
            right={
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 11,
                color: colors.green,
              }}>{sortedChapters.length}</Text>
            }
          >
            {sortedChapters.length === 1 ? 'Capítulo' : 'Capítulos'}
          </SectionLabel>

          {sortedChapters.length === 0 ? (
            <Card style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: colors.textMute,
              }}>Capítulos ainda não disponíveis</Text>
            </Card>
          ) : (
            <Card style={{ overflow: 'hidden', padding: 0 }}>
              {sortedChapters.map((chapter, index) => (
                <Pressable
                  key={chapter.id}
                  onPress={() => router.push(`/quiz/${chapter.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    gap: 14,
                    borderBottomWidth: index < sortedChapters.length - 1 ? 1 : 0,
                    borderBottomColor: colors.hairline,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.gold,
                    borderBottomWidth: 3,
                    borderBottomColor: colors.goldDeep,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Text style={{
                      fontFamily: fonts.black,
                      fontSize: 13,
                      color: '#fff',
                    }}>{chapter.number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: fonts.bold,
                      fontSize: 14,
                      color: colors.text,
                    }}>{chapter.title ?? `Capítulo ${chapter.number}`}</Text>
                    <Text style={{
                      fontFamily: fonts.semi,
                      fontSize: 12,
                      color: colors.textMute,
                      marginTop: 2,
                    }}>p. {chapter.start_page}–{chapter.end_page}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMute} />
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
