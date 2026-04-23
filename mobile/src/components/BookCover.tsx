import { View, Text, Image, type ViewStyle, type ImageStyle, type StyleProp } from 'react-native';
import { Sword, Star, Compass, Target, Crown, Zap } from 'lucide-react-native';
import { fonts } from '../theme/tokens';
import { coverFromId, type Emblem } from '../theme/bookCover';
import type { Book } from '../types/database';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const DIMS: Record<Size, { w: number; h: number; icon: number; title: number; radius: number; pad: number }> = {
  xs: { w: 42, h: 58,  icon: 18, title: 8,  radius: 8,  pad: 8  },
  sm: { w: 56, h: 78,  icon: 22, title: 9,  radius: 12, pad: 8  },
  md: { w: 88, h: 122, icon: 32, title: 11, radius: 18, pad: 12 },
  lg: { w: 120, h: 168, icon: 44, title: 14, radius: 22, pad: 12 },
};

const EMBLEM_ICON: Record<Emblem, any> = {
  sword: Sword, star: Star, compass: Compass, target: Target, crown: Crown, zap: Zap,
};

interface Props {
  book: Book;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
}

export function BookCover({ book, size = 'md', style, glow = false }: Props) {
  const d = DIMS[size];

  if (book.cover_url) {
    const imgStyle: StyleProp<ImageStyle> = { width: d.w, height: d.h, borderRadius: d.radius };
    return (
      <Image
        testID="book-cover-image"
        source={{ uri: book.cover_url }}
        style={[imgStyle, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
      />
    );
  }

  const { color, deep, emblem } = coverFromId(book.id);
  const IconCmp = EMBLEM_ICON[emblem];
  return (
    <View
      testID="book-cover-emblem"
      style={[{
        width: d.w,
        height: d.h,
        borderRadius: d.radius,
        backgroundColor: color,
        padding: d.pad,
        justifyContent: 'space-between',
        borderBottomWidth: 3,
        borderBottomColor: deep,
        shadowColor: glow ? color : '#000',
        shadowOpacity: glow ? 0.4 : 0.5,
        shadowOffset: { width: 0, height: glow ? 12 : 8 },
        shadowRadius: glow ? 24 : 20,
        elevation: glow ? 6 : 4,
      }, style]}
    >
      <IconCmp size={d.icon} color="#fff" strokeWidth={2.2} />
      {size !== 'xs' && (
        <Text numberOfLines={2} style={{
          color: '#fff',
          fontFamily: fonts.black,
          fontSize: d.title,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          lineHeight: d.title * 1.1,
        }}>
          {book.title}
        </Text>
      )}
    </View>
  );
}
