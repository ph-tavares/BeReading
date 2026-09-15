// Estante (spec 7.7, F6 Tarefa 1). Lendo e Lidos num Segmented, pull-to-refresh
// mantido, vazio com lombadas. O limite do gratuito (BER-58) aparece como texto
// no subtitulo, nunca como barra (DESIGN.md secao 10).
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useEntitlementStore } from '../../src/stores/entitlementStore';
import { getBookWithChapters, getMyAnswers, getStudentBooks } from '../../src/api/queries';
import type { MyAnswer } from '../../src/api/queries';
import { sectionBooksByStatus } from '../../src/utils/bookUtils';
import { Banner, EmptyState, Screen, Segmented, Skeleton, Text } from '../../src/ui';
import { FinishedShelf, ShelfBookRow, bookAverage, readProgress, shelfSubtitle } from '../../src/features/shelf';
import { radius, space } from '../../src/theme/tokens';
import type { Book, StudentBook } from '../../src/types/database';

type Entry = StudentBook & { book: Book };
type Aba = 'lendo' | 'lidos';

export default function LivrosScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const entitlement = useEntitlementStore((s) => s.entitlement);

  const [books, setBooks] = useState<Entry[] | null>(null);
  const [averages, setAverages] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [aba, setAba] = useState<Aba>('lendo');

  const load = useCallback(async (userId: string) => {
    setError(false);
    useEntitlementStore.getState().refresh();
    try {
      const entries = await getStudentBooks(userId);
      setBooks(entries);

      // A media dos lidos precisa dos capitulos de cada livro. Falhar aqui so
      // esconde a media, nunca a estante.
      const lidos = entries.filter((e) => e.status === 'finished');
      if (lidos.length === 0) {
        setAverages({});
        return;
      }
      try {
        const [respostas, capitulos] = await Promise.all([
          getMyAnswers(userId),
          Promise.all(lidos.map((e) => getBookWithChapters(e.book.id).catch(() => null))),
        ]);
        setAverages(mediasPorLivro(lidos, capitulos, respostas));
      } catch {
        setAverages({});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!profile) { setLoading(false); return; }
      load(profile.user_id);
    }, [profile, load]),
  );

  const onRefresh = useCallback(() => {
    if (!profile) return;
    setRefreshing(true);
    load(profile.user_id);
  }, [profile, load]);

  const { reading, finished } = sectionBooksByStatus(books ?? []);
  const maxBooks = entitlement?.plan === 'free' ? entitlement.limits.max_active_books : null;

  if (loading) {
    return (
      <Screen title="Estante" contentStyle={styles.content}>
        <Skeleton width="100%" height={44} borderRadius={radius.control} />
        <Skeleton width="100%" height={78} borderRadius={radius.card} />
        <Skeleton width="100%" height={78} borderRadius={radius.card} />
      </Screen>
    );
  }

  const banner = error
    ? <Banner tone="danger" message="Não deu pra carregar sua estante. Puxe pra atualizar." onRetry={onRefresh} />
    : null;

  if (books !== null && reading.length === 0 && finished.length === 0) {
    return (
      <Screen title="Estante" refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
        {banner}
        <EmptyState
          title="Sua estante está vazia."
          description="Escolha um livro em Explorar e comece a registrar sua leitura."
          actionLabel="Explorar livros"
          onAction={() => router.push('/(tabs)/catalogo')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Estante"
      subtitle={books === null ? undefined : shelfSubtitle(reading.length, maxBooks)}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={styles.content}
    >
      {banner}
      <Segmented
        options={[
          { value: 'lendo', label: `Lendo · ${reading.length}` },
          { value: 'lidos', label: `Lidos · ${finished.length}` },
        ]}
        value={aba}
        onChange={(v) => setAba(v as Aba)}
      />

      {aba === 'lendo' ? (
        reading.length === 0 ? (
          <Text variant="callout" tone="tertiary">Nenhum livro em leitura agora. Explorar tem o próximo.</Text>
        ) : (
          <View>
            {reading.map((e, i) => (
              <ShelfBookRow
                key={e.id}
                book={e.book}
                currentPage={e.current_page}
                progress={readProgress(e)}
                onPress={() => router.push(`/book/${e.book.id}`)}
                last={i === reading.length - 1}
              />
            ))}
          </View>
        )
      ) : finished.length === 0 ? (
        <Text variant="callout" tone="tertiary">Os livros que você terminar ficam aqui.</Text>
      ) : (
        <FinishedShelf
          items={finished.map((e) => ({ book: e.book, average: averages[e.book.id] ?? null }))}
          onPressBook={(id) => router.push(`/book/${id}`)}
        />
      )}
    </Screen>
  );
}

function mediasPorLivro(
  lidos: Entry[],
  capitulos: ({ chapters: { id: string }[] } | null)[],
  respostas: MyAnswer[],
): Record<string, number | null> {
  const medias: Record<string, number | null> = {};
  lidos.forEach((e, i) => {
    const doLivro = capitulos[i];
    medias[e.book.id] = doLivro ? bookAverage(respostas, doLivro.chapters.map((c) => c.id)) : null;
  });
  return medias;
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, gap: space.xl },
});
