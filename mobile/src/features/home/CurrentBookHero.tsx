// Hero do livro em leitura (spec S7.1, mockup 04): capa, titulo, autor, meta
// de capitulo (quando ha paginacao) e barra de progresso do livro inteiro.
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Cover } from '../../ui/Cover';
import { Tag } from '../../ui/Tag';
import { ProgressBar } from '../../ui/ProgressBar';
import { space } from '../../theme/tokens';
import type { Book } from '../../types/database';
import type { ChapterGoal } from './logic';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url' | 'total_pages'>;
  currentPage: number;
  goal: ChapterGoal | null;
  onPress: () => void;
}

const COVER_WIDTH = 86; // Documentado em src/ui/Cover.tsx: 86 na Hoje.

export function CurrentBookHero({ book, currentPage, goal, onPress }: Props) {
  const progress = book.total_pages > 0 ? currentPage / book.total_pages : 0;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${book.title}, de ${book.author}. ${pct}% lido.`}
      onPress={onPress}
      style={styles.row}
    >
      <Cover book={book} width={COVER_WIDTH} />
      <View style={styles.info}>
        <Tag label="Lendo agora" tone="accent" />
        <Text variant="heading" numberOfLines={2} style={styles.title}>{book.title}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>{book.author}</Text>
        {goal ? (
          <Text variant="caption" tone="tertiary">
            {`cap. ${goal.chapterNumber} de ${goal.totalChapters} · ${
              goal.remainingPages === 1 ? 'falta' : 'faltam'
            } ${goal.remainingPages} pág. pra fechar`}
          </Text>
        ) : null}
        <View style={styles.progressRow}>
          <Text variant="caption" tone="secondary">{`pág. ${currentPage} de ${book.total_pages}`}</Text>
          <Text variant="label" tone="primary">{`${pct}%`}</Text>
        </View>
        <ProgressBar
          progress={progress}
          accessibilityLabel={`${pct} por cento do livro lido`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  info: { flex: 1, minWidth: 0, gap: space.xs, justifyContent: 'center' },
  title: { marginTop: space.xs },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
});
