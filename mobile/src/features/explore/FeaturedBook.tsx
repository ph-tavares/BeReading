// Destaque de Explorar (spec 7.8): o primeiro livro que o leitor ainda nao
// comecou. Uma acao primaria so, "Começar a ler", e o detalhe como saida discreta.
import { StyleSheet, View } from 'react-native';
import { Button, Card, Cover, Tag, Text } from '../../ui';
import { space } from '../../theme/tokens';
import type { Book } from '../../types/database';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'genre' | 'total_pages'>;
  starting: boolean;
  onStart: () => void;
  onOpen: () => void;
}

export function FeaturedBook({ book, starting, onStart, onOpen }: Props) {
  return (
    <View testID="explorar-destaque">
      <Card style={styles.card}>
        <View style={styles.topo}>
          <Cover book={book} size="sm" />
          <View style={styles.info}>
            <Text variant="label" tone="accent">Pra começar</Text>
            <Text variant="heading" numberOfLines={3}>{book.title}</Text>
            <Text variant="callout" tone="secondary" numberOfLines={1}>{book.author}</Text>
            <View style={styles.tags}>
              {book.genre ? <Tag label={book.genre} /> : null}
              <Tag label={`${book.total_pages} páginas`} />
            </View>
          </View>
        </View>
        <Button onPress={onStart} loading={starting}>Começar a ler</Button>
        <Button variant="ghost" onPress={onOpen}>Ver o livro</Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  topo: { flexDirection: 'row', gap: space.lg },
  info: { flex: 1, minWidth: 0, gap: space.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
