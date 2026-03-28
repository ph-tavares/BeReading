import { View, Text, StyleSheet } from 'react-native';

interface Props {
  streak: number;
  /** Usar paleta invertida para fundos escuros (ex: header índigo) */
  dark?: boolean;
}

export function StreakBadge({ streak, dark = false }: Props) {
  return (
    <View style={[styles.pill, dark ? styles.pillDark : styles.pillLight]}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.count, dark ? styles.textDark : styles.textLight]}>
        {streak}
      </Text>
      <Text style={[styles.label, dark ? styles.labelDark : styles.labelLight]}>
        {streak === 1 ? 'dia' : 'dias'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  pillLight: {
    backgroundColor: '#FEF3C7',
  },
  pillDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  flame: {
    fontSize: 16,
  },
  count: {
    fontSize: 16,
    fontWeight: '800',
  },
  textLight: {
    color: '#92400E',
  },
  textDark: {
    color: '#FCD34D',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelLight: {
    color: '#B45309',
  },
  labelDark: {
    color: '#FDE68A',
  },
});
