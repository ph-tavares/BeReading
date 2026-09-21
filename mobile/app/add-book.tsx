// Cadastrar um livro fora do catalogo (BER-60). O leitor chega com o livro na
// mao e ele nao esta no Explorar: com o ISBN, a Open Library preenche titulo,
// autor, paginas e capa; sem ISBN, ele digita. O que so o leitor sabe e quantos
// capitulos a edicao dele tem, e isso vem do sumario.
//
// Depois de gravar, o livro entra em leitura pelo mesmo caminho do Explorar
// (reading-list), entao a cota do plano gratuito vale igual e o paywall aparece
// no mesmo lugar.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Barcode } from 'lucide-react-native';
import { addBook, lookupBookByIsbn, startReadingBook } from '../src/api/edgeFunctions';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { PaywallSheet } from '../src/components/PaywallSheet';
import { isQuotaExceededError, type QuotaExceeded } from '../src/utils/billing';
import { Button, Cover, Field, Screen, Text, useToast } from '../src/ui';
import {
  EMPTY_FORM, contentMessage, isValidIsbn, normalizeIsbn, prefillFromLookup, validateForm,
  type AddBookForm, type FormErrors,
} from '../src/features/add-book/logic';
import { color, radius, space } from '../src/theme/tokens';

type Busca = 'idle' | 'buscando' | 'achou' | 'nao-achou' | 'erro';

const AVISO_BUSCA: Record<Exclude<Busca, 'idle' | 'buscando'>, string> = {
  achou: 'Achamos o livro. Confere os dados abaixo.',
  'nao-achou': 'Não achamos esse ISBN. Preenche à mão, leva um minuto.',
  erro: 'A busca falhou agora. Dá pra preencher à mão.',
};

export default function AddBookScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ title?: string }>();

  const [form, setForm] = useState<AddBookForm>({ ...EMPTY_FORM, title: params.title ?? '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [busca, setBusca] = useState<Busca>('idle');
  const [enviando, setEnviando] = useState(false);
  const [paywall, setPaywall] = useState<{ quota: QuotaExceeded; bookId: string } | null>(null);

  const campo = (nome: keyof AddBookForm) => (valor: string) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErrors((atual) => ({ ...atual, [nome]: undefined }));
  };

  async function buscarIsbn() {
    const isbn = normalizeIsbn(form.isbn);
    if (!isValidIsbn(isbn)) {
      setErrors((atual) => ({ ...atual, isbn: 'O ISBN tem 10 ou 13 dígitos.' }));
      return;
    }
    setBusca('buscando');
    try {
      const resultado = await lookupBookByIsbn(isbn);
      setForm((atual) => prefillFromLookup(atual, resultado));
      setBusca(resultado.found ? 'achou' : 'nao-achou');
    } catch (e) {
      console.error('Falha no lookup por ISBN:', e);
      setBusca('erro');
    }
  }

  async function cadastrar() {
    if (enviando) return;
    const { errors: encontrados, payload } = validateForm(form);
    setErrors(encontrados);
    if (!payload) return;

    setEnviando(true);
    let bookId: string | null = null;
    try {
      const { book, created, content } = await addBook(payload);
      bookId = book.id;
      await startReadingBook(book.id);
      useEntitlementStore.getState().refresh();
      toast.show({
        message: `${book.title} entrou na sua estante.`,
        // Mesmo ISBN de novo devolve o livro que já existia: o do catálogo ou o que o leitor cadastrou.
        detail: created ? contentMessage(content) : book.added_by ? 'Você já tinha cadastrado esse livro.' : 'Ele já estava no catálogo.',
        tone: 'positive',
      });
      router.replace(`/book/${book.id}`);
    } catch (e: unknown) {
      if (isQuotaExceededError(e) && bookId) {
        setPaywall({ quota: e.quota, bookId });
        return;
      }
      console.error('Falha ao cadastrar o livro:', e);
      toast.show({ message: 'Não deu pra cadastrar o livro.', detail: 'Tenta de novo daqui a pouco.', tone: 'danger' });
    } finally {
      setEnviando(false);
    }
  }

  // O KeyboardAvoidingView envolve o Screen, e nao o contrario (BER-121,
  // __tests__/guards/teclado.test.ts): com o cabecalho acima dele, sobra a
  // altura do cabecalho por baixo do teclado.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Cadastrar livro" onClose={() => router.back()} closeDisabled={enviando} edges={['bottom']} contentStyle={styles.content}>
        <Text variant="body" tone="secondary">
          Não achou no catálogo? Cadastra o seu. Com o ISBN a gente preenche quase tudo.
        </Text>

        <View style={styles.isbn}>
          <View style={styles.isbnCampo}>
            <Field
              label="ISBN (opcional)"
              icon={Barcode}
              value={form.isbn}
              onChangeText={campo('isbn')}
              placeholder="978..."
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={buscarIsbn}
              error={errors.isbn}
              hint="Fica no verso do livro, perto do código de barras."
            />
          </View>
          <Button
            variant="secondary"
            size="md"
            onPress={buscarIsbn}
            loading={busca === 'buscando'}
            disabled={!form.isbn.trim()}
            accessibilityLabel="Buscar o livro pelo ISBN"
            style={styles.buscar}
          >
            Buscar
          </Button>
        </View>

        {busca !== 'idle' && busca !== 'buscando' ? (
          <Text variant="caption" tone={busca === 'achou' ? 'positive' : 'tertiary'} accessibilityLiveRegion="polite">
            {AVISO_BUSCA[busca]}
          </Text>
        ) : null}

        {form.coverUrl ? (
          <View style={styles.capa}>
            <Cover book={{ id: 'novo', title: form.title, author: form.author, cover_url: form.coverUrl }} size="sm" />
          </View>
        ) : null}

        <Field label="Título" value={form.title} onChangeText={campo('title')} error={errors.title} returnKeyType="next" />
        <Field label="Autor" value={form.author} onChangeText={campo('author')} error={errors.author} returnKeyType="next" />

        <View style={styles.numeros}>
          <View style={styles.numero}>
            <Field
              label="Páginas"
              value={form.totalPages}
              onChangeText={campo('totalPages')}
              keyboardType="number-pad"
              error={errors.totalPages}
            />
          </View>
          <View style={styles.numero}>
            <Field
              label="Capítulos"
              value={form.chapterCount}
              onChangeText={campo('chapterCount')}
              keyboardType="number-pad"
              error={errors.chapterCount}
            />
          </View>
        </View>

        {/* BER-60, item 4 da issue: dizer antes, e nao depois, o que o app ainda
            nao sabe desse livro. */}
        <View style={styles.aviso}>
          <Text variant="caption" tone="secondary">
            Cada capítulo fecha com um quiz. A gente busca o conteúdo dele na hora e, com o ISBN, também confere os fatos em fontes independentes, o que leva alguns minutos. O quiz sempre diz de onde veio.
            As páginas de cada capítulo são aproximadas.
          </Text>
        </View>

        <Button onPress={cadastrar} loading={enviando} accessibilityLabel="Cadastrar o livro e começar a ler">
          Cadastrar e começar a ler
        </Button>
      </Screen>

      <PaywallSheet
        quota={paywall?.quota ?? null}
        onDismiss={() => {
          // O livro ja existe; so nao entrou em leitura por causa da cota.
          const id = paywall?.bookId;
          setPaywall(null);
          if (id) router.replace(`/book/${id}`);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.lg },
  isbn: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  isbnCampo: { flex: 1 },
  buscar: { marginTop: space.xl },
  capa: { alignItems: 'center' },
  numeros: { flexDirection: 'row', gap: space.md },
  numero: { flex: 1 },
  aviso: {
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
  },
});
