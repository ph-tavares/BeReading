import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Lock } from 'lucide-react-native';
import { getBookWithChapters, getCurrentPage } from '../../src/api/queries';
import { TopBar } from '../../src/components/TopBar';
import { BookCover } from '../../src/components/BookCover';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Press3DButton } from '../../src/components/Press3DButton';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, fonts, radii } from '../../src/theme/tokens';
import { categoryOf } from '../../src/theme/categories';
import { chapterLockState } from '../../src/utils/chapterGate';
import type { Book, Chapter } from '../../src/types/database';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [data, setData] = useState<(Book & { chapters: Chapter[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // BER-48: até onde o leitor chegou neste livro. `null` = ainda não se sabe.
  const [currentPage, setCurrentPage] = useState<number | null>(null);

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

  useEffect(() => {
    if (!id || !profile) return;
    let cancelled = false;

    getCurrentPage(profile.user_id, id)
      .then((page) => { if (!cancelled) setCurrentPage(page); })
      // Sem a página atual a tela não bloqueia nada; a trava de verdade é o servidor.
      .catch(() => { if (!cancelled) setCurrentPage(null); });

    return () => { cancelled = true; };
  }, [id, profile?.user_id]);

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
              {sortedChapters.map((chapter, index) => {
                // BER-48: quiz fechado até o leitor chegar ao fim do capítulo. Sem saber
                // a página atual, não bloqueia — o servidor ainda recusa com 403.
                const lock = currentPage === null
                  ? { unlocked: true, pagesLeft: 0 }
                  : chapterLockState(chapter.end_page, currentPage);
                const locked = !lock.unlocked;
                const title = chapter.title ?? `Capítulo ${chapter.number}`;

                return (
                  <Pressable
                    key={chapter.id}
                    onPress={locked ? undefined : () => router.push(`/quiz/${chapter.id}`)}
                    disabled={locked}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: locked }}
                    accessibilityLabel={locked
                      ? `${title}. Quiz fechado: leia até a página ${chapter.end_page}.`
                      : `${title}. Abrir o quiz.`}
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
                      backgroundColor: locked ? colors.surface : colors.gold,
                      borderBottomWidth: 3,
                      borderBottomColor: locked ? colors.surface2 : colors.goldDeep,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Text style={{
                        fontFamily: fonts.black,
                        fontSize: 13,
                        color: locked ? colors.textMute : '#fff',
                      }}>{chapter.number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontFamily: fonts.bold,
                        fontSize: 14,
                        color: locked ? colors.textSoft : colors.text,
                      }}>{title}</Text>
                      <Text style={{
                        fontFamily: fonts.semi,
                        fontSize: 12,
                        color: colors.textMute,
                        marginTop: 2,
                      }}>
                        {locked
                          ? `Leia até a p. ${chapter.end_page} para abrir o quiz`
                          : `p. ${chapter.start_page}–${chapter.end_page}`}
                      </Text>
                    </View>
                    {locked
                      ? <Lock size={16} color={colors.textMute} strokeWidth={2.2} />
                      : <ChevronRight size={18} color={colors.textMute} />}
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
