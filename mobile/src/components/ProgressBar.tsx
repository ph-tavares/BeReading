import { View, StyleSheet } from 'react-native';

interface Props {
  /** Valor entre 0 e 1 */
  progress: number;
}

export function ProgressBar({ progress }: Props) {
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
});
