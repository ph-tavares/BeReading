import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from './Card';
import { BookCover } from './BookCover';
import { ProgressBar } from './ProgressBar';
import { colors, fonts } from '../theme/tokens';
import { coverFromId } from '../theme/bookCover';
import type { StudentBook, Book } from '../types/database';

interface Props {
  studentBook: StudentBook;
  book: Book;
}

export function BookCard({ studentBook, book }: Props) {
  const router = useRouter();
  const progress = book.total_pages > 0 ? studentBook.current_page / book.total_pages : 0;
  const pct = Math.round(progress * 100);
  const { color, deep } = coverFromId(book.id);

  return (
    <Card onPress={() => router.push(`/book/${book.id}`)} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <BookCover book={book} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{
            fontFamily: fonts.black,
            fontSize: 15,
            color: colors.text,
            lineHeight: 18,
            letterSpacing: -0.1,
          }}>{book.title}</Text>
          <Text numberOfLines={1} style={{
            fontFamily: fonts.semi,
            fontSize: 11.5,
            color: colors.textMute,
            marginTop: 2,
            marginBottom: 10,
          }}>{book.author}</Text>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}>
            <Text style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              color: colors.textMute,
            }}>
              pág. {studentBook.current_page}/{book.total_pages}
            </Text>
            <Text style={{
              fontFamily: fonts.black,
              fontSize: 11,
              color: colors.green,
            }}>{pct}%</Text>
          </View>
          <ProgressBar progress={progress} height={8} color={color} colorDeep={deep} />
        </View>
      </View>
    </Card>
  );
}
