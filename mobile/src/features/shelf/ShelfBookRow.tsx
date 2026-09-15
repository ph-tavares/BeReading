// Linha de livro em leitura na Estante (spec 7.7): capa 52, titulo, pagina e
// barra do livro inteiro. Toque abre o detalhe do livro.
//
// O layout mora no View interno, nunca no `style` em funcao do Pressable: com
// a interop do NativeWind, o estilo em funcao some no aparelho (a capa caia em
// cima do texto no teste em emulador de 15/09), e o Jest nao acusa.
import { Pressable, StyleSheet, View } from 'react-native';
import { Cover, ProgressBar, Text } from '../../ui';
import { color, space } from '../../theme/tokens';
import type { Book } from '../../types/database';

const LARGURA_DA_CAPA = 52; // Documentado em src/ui/Cover.tsx: 52 na Estante.

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'total_pages'>;
  currentPage: number;
  progress: number;
  onPress: () => void;
  last?: boolean;
}

export function ShelfBookRow({ book, currentPage, progress, onPress, last = false }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${book.title}, de ${book.author}. Página ${currentPage} de ${book.total_pages}.`}
      onPress={onPress}
    >
      <View style={[styles.row, last ? null : styles.divider]}>
        <Cover book={book} width={LARGURA_DA_CAPA} />
        <View style={styles.info}>
          <Text variant="subhead" numberOfLines={2}>{book.title}</Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {`${book.author} · pág. ${currentPage} de ${book.total_pages}`}
          </Text>
          <ProgressBar progress={progress} accessibilityLabel={`${pct} por cento do livro lido`} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  info: { flex: 1, minWidth: 0, gap: space.xs },
});
