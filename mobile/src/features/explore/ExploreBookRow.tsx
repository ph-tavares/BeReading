// Linha do catalogo (spec 7.8): capa, titulo, autor e o estado do livro pro
// leitor. Toque na linha abre o detalhe; "Comecar" poe na estante.
//
// "Comecar" e uma pilula compacta, nao o Button do sistema: no teste em
// emulador de 15/09 o Button de 56 de altura dentro da linha disputava peso
// com o titulo. O alvo de toque continua com MIN_TOUCH de altura.
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Cover, ListRow, Tag, Text } from '../../ui';
import { MIN_TOUCH, color, radius, space } from '../../theme/tokens';
import type { Book } from '../../types/database';
import type { ExploreState } from './logic';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  state: ExploreState;
  starting: boolean;
  onOpen: () => void;
  onStart: () => void;
  last?: boolean;
}

export function ExploreBookRow({ book, state, starting, onOpen, onStart, last = false }: Props) {
  const trailing =
    state === 'reading' ? <Tag label="Lendo" tone="accent" />
    : state === 'finished' ? <Tag label="Lido" tone="positive" />
    : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Começar ${book.title}`}
        accessibilityState={{ busy: starting, disabled: starting }}
        onPress={starting ? undefined : onStart}
        disabled={starting}
      >
        <View style={styles.pilula}>
          {starting
            ? <ActivityIndicator size="small" color={color.text2} />
            : <Text variant="label">Começar</Text>}
        </View>
      </Pressable>
    );

  return (
    <ListRow
      title={book.title}
      subtitle={book.author}
      leading={<Cover book={book} size="xs" />}
      trailing={trailing}
      onPress={onOpen}
      accessibilityLabel={`Abrir ${book.title}, de ${book.author}.`}
      last={last}
    />
  );
}

const styles = StyleSheet.create({
  pilula: {
    minHeight: MIN_TOUCH,
    minWidth: 96,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: color.surface2,
  },
});
