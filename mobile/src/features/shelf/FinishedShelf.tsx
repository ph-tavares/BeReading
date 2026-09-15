// Prateleira de lidos (spec 7.7): capas em grade, com a media do livro quando
// ha nota. Sem trofeu nem dourado: terminar um livro e o proprio premio.
// Layout no View interno, nao no `style` em funcao do Pressable (ver ShelfBookRow).
import { Pressable, StyleSheet, View } from 'react-native';
import { Cover, Text } from '../../ui';
import { space } from '../../theme/tokens';
import type { Book } from '../../types/database';

interface Item {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  average: number | null;
}

interface Props {
  items: Item[];
  onPressBook: (bookId: string) => void;
}

export function FinishedShelf({ items, onPressBook }: Props) {
  return (
    <View style={styles.grade}>
      {items.map(({ book, average }) => (
        <Pressable
          key={book.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${book.title}, de ${book.author}.${average === null ? '' : ` Média ${average}.`}`}
          onPress={() => onPressBook(book.id)}
        >
          <View style={styles.item}>
            <Cover book={book} size="sm" />
            <Text variant="caption" numberOfLines={2}>{book.title}</Text>
            {average === null ? null : <Text variant="caption" tone="secondary">{`média ${average}`}</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  item: { width: 74, gap: space.xs },
});
