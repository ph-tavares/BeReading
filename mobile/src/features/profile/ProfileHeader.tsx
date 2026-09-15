// Cabecalho de Voce (spec 7.9): anel 84 com o monograma, nome, nivel e XP.
import { StyleSheet, View } from 'react-native';
import { Ring, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { formatXp, type LevelInfo } from '../../game/xp';
import { monogram } from './logic';

const RING_SIZE = 84; // Documentado em src/ui/Ring.tsx: 84 em Voce.

interface Props {
  name: string;
  level: LevelInfo;
  xp: number;
}

export function ProfileHeader({ name, level, xp }: Props) {
  const xpText = level.next === null ? `${formatXp(xp)} XP` : `${formatXp(xp)} de ${formatXp(level.next)} XP`;
  return (
    <View style={styles.row}>
      <Ring progress={level.progress} size={RING_SIZE} accessibilityLabel={`Nível ${level.level}, ${xpText}`}>
        <Text variant="numericL">{monogram(name)}</Text>
      </Ring>
      <View style={styles.info}>
        <Text variant="title" numberOfLines={1}>{name}</Text>
        <Text variant="callout" tone="secondary">{`Nível ${level.level} · ${level.title}`}</Text>
        <Text variant="caption" tone="tertiary">{xpText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  info: { flex: 1, minWidth: 0, gap: space.xs },
});
