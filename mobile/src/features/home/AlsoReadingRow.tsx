// Fileira "Também lendo" (spec S7.1, mockup 04): so aparece com 2 livros ou
// mais em leitura (decisao do chamador). Capas de 48 (Cover size="xs").
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Cover } from '../../ui/Cover';
import { space } from '../../theme/tokens';

interface BookRef {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
}

interface Props {
  books: BookRef[];
  onPressBook: (id: string) => void;
}

export function AlsoReadingRow({ books, onPressBook }: Props) {
  if (books.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary">Também lendo</Text>
      <View style={styles.row}>
        {books.map((book) => (
          <Pressable
            key={book.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${book.title}, de ${book.author}`}
            onPress={() => onPressBook(book.id)}
          >
            <Cover book={book} size="xs" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
});
