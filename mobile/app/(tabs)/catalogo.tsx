// Explorar (spec 7.8, F6 Tarefa 2). Busca por titulo ou autor com debounce de
// 300 ms, generos reais em chips, destaque do primeiro livro nao comecado e
// linhas com estado. Comecar passa pela Edge Function reading-list (BER-58),
// com PaywallSheet no 402 e toast no lugar do Alert.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useEntitlementStore } from '../../src/stores/entitlementStore';
import { ProfileErrorState } from '../../src/components/ProfileErrorState';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { getBooks, getStudentBooks } from '../../src/api/queries';
import { startReadingBook } from '../../src/api/edgeFunctions';
import { isQuotaExceededError, type QuotaExceeded } from '../../src/utils/billing';
import { Banner, Chip, EmptyState, Field, Screen, Skeleton, Text, useToast } from '../../src/ui';
import {
  ExploreBookRow, FeaturedBook, exploreState, featuredBook, filterByGenre, genresOf,
} from '../../src/features/explore';
import { radius, space } from '../../src/theme/tokens';
import type { Book } from '../../src/types/database';

const DEBOUNCE_MS = 300;

export default function CatalogoScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, profileStatus } = useAuthStore();
  const userId = profile?.user_id ?? null;

  const [books, setBooks] = useState<Book[]>([]);
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<QuotaExceeded | null>(null);

  useEffect(() => {
    // BER-45: sem perfil, o carregamento inicial nunca terminaria.
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setError(false);

    Promise.all([getBooks(), getStudentBooks(userId)])
      .then(([todos, meus]) => {
        if (cancelled) return;
        setBooks(todos);
        setStatusById(Object.fromEntries(meus.map((sb) => [sb.book_id, sb.status])));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getBooks(search.trim() || undefined)
        .then((resultado) => { if (!cancelled) setBooks(resultado); })
        // Falha na busca mantem a lista atual: o leitor tenta de novo digitando.
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, loading]);

  async function handleStart(book: Book) {
    if (!userId || startingId) return;
    setStartingId(book.id);
    try {
      await startReadingBook(book.id);
      setStatusById((atual) => ({ ...atual, [book.id]: 'reading' }));
      useEntitlementStore.getState().refresh();
      toast.show({ message: `${book.title} entrou na sua estante.`, detail: 'Registre a primeira leitura quando quiser.', tone: 'positive' });
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        setPaywall(e.quota);
        return;
      }
      toast.show({ message: 'Não deu pra começar esse livro.', detail: 'Tenta de novo daqui a pouco.', tone: 'danger' });
    } finally {
      setStartingId(null);
    }
  }

  if (profileStatus === 'error') return <ProfileErrorState />;

  const generos = genresOf(books);
  const generoAtivo = genre !== null && generos.includes(genre) ? genre : null;
  const lista = filterByGenre(books, generoAtivo);
  const destaque = search.trim() === '' && generoAtivo === null ? featuredBook(books, statusById) : null;
  const linhas = destaque ? lista.filter((b) => b.id !== destaque.id) : lista;

  return (
    <Screen title="Explorar" subtitle="Seu próximo livro está aqui." contentStyle={styles.content}>
      <Field
        label="Buscar"
        icon={Search}
        value={search}
        onChangeText={setSearch}
        placeholder="Título ou autor"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {error ? (
        <Banner tone="danger" message="Não deu pra carregar o catálogo." onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} />
      ) : null}

      {loading ? (
        <View style={styles.lista}>
          <Skeleton width="100%" height={180} borderRadius={radius.card} />
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={64} />
        </View>
      ) : (
        <>
          {generos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todos" selected={generoAtivo === null} onPress={() => setGenre(null)} />
              {generos.map((g) => (
                <Chip key={g} label={g} selected={generoAtivo === g} onPress={() => setGenre(g)} />
              ))}
            </ScrollView>
          ) : null}

          {destaque ? (
            <FeaturedBook
              book={destaque}
              starting={startingId === destaque.id}
              onStart={() => handleStart(destaque)}
              onOpen={() => router.push(`/book/${destaque.id}`)}
            />
          ) : null}

          {lista.length === 0 && !error ? (
            <EmptyState
              illustration="none"
              title={search.trim() ? 'Nada com esse nome por aqui.' : 'Nenhum livro nesse gênero ainda.'}
              description={search.trim() ? 'Tente outro título ou autor.' : 'Escolha outro gênero ou veja todos.'}
            />
          ) : linhas.length > 0 ? (
            <View>
              <Text variant="label" tone="secondary" style={styles.secao}>
                {generoAtivo ?? (search.trim() ? 'Resultados' : 'Todos os livros')}
              </Text>
              {linhas.map((b, i) => (
                <ExploreBookRow
                  key={b.id}
                  book={b}
                  state={exploreState(statusById, b.id)}
                  starting={startingId === b.id}
                  onOpen={() => router.push(`/book/${b.id}`)}
                  onStart={() => handleStart(b)}
                  last={i === linhas.length - 1}
                />
              ))}
            </View>
          ) : null}
        </>
      )}

      <PaywallSheet quota={paywall} onDismiss={() => setPaywall(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, gap: space.lg },
  lista: { gap: space.md },
  chips: { gap: space.sm },
  secao: { marginBottom: space.xs },
});
