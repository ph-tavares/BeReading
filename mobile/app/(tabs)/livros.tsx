import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, CheckCheck } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { getStudentBooks } from '../../src/api/queries';
import { BookCard } from '../../src/components/BookCard';
import { BookCover } from '../../src/components/BookCover';
import { Press3DButton } from '../../src/components/Press3DButton';
import { SectionLabel } from '../../src/components/SectionLabel';
import { sectionBooksByStatus } from '../../src/utils/bookUtils';
import { colors, fonts } from '../../src/theme/tokens';
import type { StudentBook, Book } from '../../src/types/database';

export default function LivrosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [books, setBooks] = useState<(StudentBook & { book: Book })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) { setLoading(false); return; }
      let cancelled = false;
      setError(null);

      getStudentBooks(profile.user_id)
        .then((data) => { if (!cancelled) setBooks(data); })
        .catch(() => {
          if (!cancelled) setError('Não foi possível carregar seus livros.');
        })
        .finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }, [profile]),
  );

  async function handleRefresh() {
    if (!profile) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await getStudentBooks(profile.user_id);
      setBooks(data);
    } catch {
      setError('Não foi possível carregar seus livros.');
    } finally {
      setRefreshing(false);
    }
  }

  const { reading, finished } = sectionBooksByStatus(books);
  const hasBooks = reading.length > 0 || finished.length > 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.green}
          />
        }
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
          }}>Estante</Text>
          <Text style={{
            fontFamily: fonts.semi,
            fontSize: 13,
            color: colors.textMute,
            marginTop: 2,
          }}>
            {reading.length} em leitura · {finished.length} finalizado{finished.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {error && (
            <View style={{
              backgroundColor: 'rgba(244,63,94,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(244,63,94,0.3)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontFamily: fonts.medium, color: colors.rose, fontSize: 13, textAlign: 'center' }}>
                {error}
              </Text>
            </View>
          )}

          {!hasBooks ? (
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
              <Image
                source={require('../../assets/images/mascot1.png')}
                style={{ width: 140, height: 140 }}
                resizeMode="contain"
              />
              <Text style={{
                fontFamily: fonts.black,
                fontSize: 18,
                color: colors.text,
              }}>Sua estante está vazia</Text>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                color: colors.textMute,
                textAlign: 'center',
                lineHeight: 21,
                paddingHorizontal: 20,
                marginBottom: 8,
              }}>
                Explore o Catálogo e adicione livros para começar
              </Text>
              <View style={{ width: '70%' }}>
                <Press3DButton
                  onPress={() => router.push('/(tabs)/catalogo')}
                  Icon={Compass}
                >
                  Ver Catálogo
                </Press3DButton>
              </View>
            </View>
          ) : (
            <>
              {reading.length > 0 && (
                <View style={{ marginBottom: 26 }}>
                  <SectionLabel
                    right={
                      <Text style={{
                        fontFamily: fonts.black,
                        fontSize: 11,
                        color: colors.green,
                      }}>{reading.length}</Text>
                    }
                  >
                    Lendo agora
                  </SectionLabel>
                  <View style={{ gap: 12 }}>
                    {reading.map((sb) => (
                      <BookCard key={sb.id} studentBook={sb} book={sb.book} />
                    ))}
                  </View>
                </View>
              )}

              {finished.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <SectionLabel
                    right={
                      <Text style={{
                        fontFamily: fonts.black,
                        fontSize: 11,
                        color: colors.gold,
                      }}>{finished.length}</Text>
                    }
                  >
                    Troféus
                  </SectionLabel>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
                  >
                    {finished.map((sb) => (
                      <View key={sb.id} style={{ width: 120, alignItems: 'center' }}>
                        <View style={{ position: 'relative' }}>
                          <BookCover book={sb.book} size="md" glow />
                          <View style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            width: 32,
                            height: 32,
                            borderRadius: 12,
                            backgroundColor: colors.gold,
                            borderBottomWidth: 3,
                            borderBottomColor: colors.goldDeep,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <CheckCheck size={16} color="#fff" strokeWidth={3} />
                          </View>
                        </View>
                        <Text numberOfLines={2} style={{
                          fontFamily: fonts.bold,
                          fontSize: 12,
                          color: colors.text,
                          marginTop: 8,
                          textAlign: 'center',
                          lineHeight: 15,
                        }}>{sb.book.title}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
