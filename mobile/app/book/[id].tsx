// Detalhe do livro (spec 7.4, F5 Tarefa 7). A logica e a do time: pagina atual
// e status em student_books (BER-48, BER-58), tirar e voltar a ler pela Edge
// Function reading-list, PaywallSheet no 402. A composicao vem do sistema novo
// e de src/features/book. Rolar ate o capitulo atual e header que colapsa sao
// motion (F7).
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Camera } from 'lucide-react-native';
import { getBookWithChapters, getMyAnswers, getStudentBookEntry } from '../../src/api/queries';
import { startReadingBook, stopReadingBook } from '../../src/api/edgeFunctions';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { useEntitlementStore } from '../../src/stores/entitlementStore';
import { useAuthStore } from '../../src/stores/authStore';
import { isQuotaExceededError, type QuotaExceeded } from '../../src/utils/billing';
import {
  Button, Cover, EmptyState, IconButton, ProgressBar, Screen, Skeleton, Tag, Text, confirmDestructive, useToast,
} from '../../src/ui';
import { ChapterRow, answersByChapter, chapterStates } from '../../src/features/book';
import { MIN_TOUCH, radius, space } from '../../src/theme/tokens';
import type { Book, Chapter, StudentBook } from '../../src/types/database';

const LARGURA_DA_CAPA = 100; // spec 7.4 e DESIGN.md secao 5 (Cover).
const ALTURA_DA_CAPA = (LARGURA_DA_CAPA * 3) / 2;

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuthStore();
  const userId = profile?.user_id ?? null;

  const [data, setData] = useState<(Book & { chapters: Chapter[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // BER-48: até onde o leitor chegou neste livro. `null` = ainda não se sabe.
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  // BER-58: se o livro está em leitura, tirado da leitura ou nunca começado (`null`).
  const [readingStatus, setReadingStatus] = useState<StudentBook['status'] | null>(null);
  const [notas, setNotas] = useState<Record<string, (number | null)[]>>({});
  const [updatingList, setUpdatingList] = useState(false);
  const [paywall, setPaywall] = useState<QuotaExceeded | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBookWithChapters(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;

    getStudentBookEntry(userId, id)
      .then((entry) => {
        if (cancelled) return;
        setCurrentPage(entry?.current_page ?? 0);
        setReadingStatus(entry?.status ?? null);
      })
      // Sem a página atual a tela não bloqueia nada; a trava de verdade é o servidor.
      .catch(() => { if (!cancelled) setCurrentPage(null); });

    // As notas por capitulo (spec 7.4). Sem elas, capitulo lido aparece como
    // quiz esperando, e o quiz reabre com o que ja foi respondido (BER-48).
    getMyAnswers(userId)
      .then((respostas) => { if (!cancelled) setNotas(answersByChapter(respostas)); })
      .catch(() => { if (!cancelled) setNotas({}); });

    return () => { cancelled = true; };
  }, [id, userId]);

  // BER-58: no plano gratuito só dá para acompanhar alguns livros por vez. Tirar
  // um da leitura libera a vaga e guarda a página; voltar continua de onde parou.
  async function updateReadingList(action: 'start' | 'stop') {
    if (!id || updatingList) return;
    setUpdatingList(true);
    try {
      const result = action === 'start' ? await startReadingBook(id) : await stopReadingBook(id);
      setReadingStatus(result.status);
      useEntitlementStore.getState().refresh();
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        setPaywall(e.quota);
        return;
      }
      toast.show({ message: 'Não deu pra atualizar sua estante.', detail: 'Tenta de novo daqui a pouco.', tone: 'danger' });
    } finally {
      setUpdatingList(false);
    }
  }

  function handleStopReading() {
    if (updatingList) return;
    confirmDestructive({
      title: 'Tirar da leitura?',
      message: `Seu progresso fica salvo${currentPage ? ` na página ${currentPage}` : ''}. O livro sai da sua estante e libera a vaga pra outro, e dá pra voltar a ele quando quiser.`,
      confirmLabel: 'Tirar da leitura',
      onConfirm: () => { void updateReadingList('stop'); },
    });
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']} onBack={() => router.back()} contentStyle={styles.carregando}>
        <Skeleton width={LARGURA_DA_CAPA} height={ALTURA_DA_CAPA} borderRadius={radius.tag} />
        <Skeleton width="60%" height={28} />
        <Skeleton width="100%" height={56} borderRadius={radius.card} />
      </Screen>
    );
  }

  if (error || !data) {
    // Sem o voltar do cabecalho: o "Voltar" do estado ja e a saida, e dois
    // botoes com o mesmo nome confundem quem usa leitor de tela.
    return (
      <Screen scroll={false} edges={['top', 'bottom']} contentStyle={styles.centro}>
        <EmptyState
          illustration="none"
          title="Não deu pra abrir esse livro."
          description="Confere a conexão e tenta de novo."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const capitulos = [...data.chapters].sort((a, b) => a.number - b.number);
  const estados = chapterStates(capitulos, currentPage, notas);
  const pagina = currentPage ?? 0;

  return (
    <Screen scroll={false} edges={['top', 'bottom']} onBack={() => router.back()} contentStyle={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Cover book={data} width={LARGURA_DA_CAPA} />
          <View style={styles.info}>
            <Text variant="title">{data.title}</Text>
            <Text variant="callout" tone="secondary">{data.author}</Text>
            <View style={styles.tags}>
              {data.genre ? <Tag label={data.genre} /> : null}
              <Tag label={`${data.total_pages} páginas`} />
            </View>
          </View>
        </View>

        {readingStatus ? (
          <View style={styles.progresso}>
            <ProgressBar
              progress={data.total_pages > 0 ? pagina / data.total_pages : 0}
              accessibilityLabel={`Página ${pagina} de ${data.total_pages}`}
            />
            <Text variant="caption" tone="tertiary">{`pág. ${pagina} de ${data.total_pages}`}</Text>
          </View>
        ) : null}

        {readingStatus === 'reading' ? (
          <Button variant="ghost" onPress={handleStopReading} loading={updatingList}>Tirar da leitura</Button>
        ) : null}
        {readingStatus === 'dropped' ? (
          <Button variant="secondary" onPress={() => { void updateReadingList('start'); }} loading={updatingList}>
            Voltar a ler
          </Button>
        ) : null}

        <View>
          <Text variant="label" tone="secondary" style={styles.secao}>
            {capitulos.length === 1 ? 'Capítulo' : 'Capítulos'}
          </Text>
          {capitulos.length === 0 ? (
            <Text variant="callout" tone="tertiary">Os capítulos desse livro ainda não chegaram.</Text>
          ) : (
            capitulos.map((capitulo, i) => (
              <ChapterRow
                key={capitulo.id}
                chapter={capitulo}
                state={estados[capitulo.id]}
                onOpenQuiz={(capituloId) => router.push(`/quiz/${capituloId}`)}
                last={i === capitulos.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>

      {readingStatus === 'reading' ? (
        <View style={styles.barra}>
          {/* BER-100: o botao novo e o da direita. Travou numa pagina, pergunta
              aqui. O "Registrar leitura" continua sendo o acento da tela. */}
          <Button
            icon={BookOpen}
            style={styles.flex}
            onPress={() => router.push({ pathname: '/register-reading', params: { bookId: data.id } })}
          >
            Registrar leitura
          </Button>
          <IconButton
            icon={Camera}
            accessibilityLabel="Perguntar sobre uma página deste livro"
            variant="surface"
            style={styles.botaoAssistente}
            onPress={() => router.push({
              pathname: '/assistant/scan',
              params: { bookId: data.id, bookTitle: data.title },
            })}
          />
        </View>
      ) : null}

      <PaywallSheet quota={paywall} onDismiss={() => setPaywall(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  carregando: { gap: space.lg, paddingTop: space.lg },
  centro: { flexGrow: 1, justifyContent: 'center' },
  conteudo: { gap: space.xl, paddingVertical: space.lg },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  info: { flex: 1, gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  progresso: { gap: space.xs },
  secao: { marginBottom: space.sm },
  barra: { paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  botaoAssistente: { height: MIN_TOUCH + space.md },
});
