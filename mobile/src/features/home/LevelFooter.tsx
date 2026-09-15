// Linha de nivel e XP, ao fim da Hoje (spec S7.1, mockup 04).
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { color, space } from '../../theme/tokens';
import { formatXp, type LevelInfo } from '../../game/xp';

interface Props {
  level: LevelInfo;
  xp: number;
}

export function LevelFooter({ level, xp }: Props) {
  const xpText = level.next === null
    ? `${formatXp(xp)} XP`
    : `${formatXp(xp)} / ${formatXp(level.next)} XP`;

  return (
    <View style={styles.row}>
      <Text variant="caption" tone="secondary">{`Nível ${level.level} · ${level.title}`}</Text>
      <Text variant="caption" tone="secondary">{xpText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
