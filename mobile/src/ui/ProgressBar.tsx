import { StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';

interface Props {
  /** De 0 a 1. */
  progress: number;
  accessibilityLabel: string;
  /** Altura da trilha. Padrao 4: fio, nao barra de jogo. */
  height?: number;
}

// Sai o labio de 2px e o brilho branco da barra antiga. A leitura do progresso
// vem do contraste entre a trilha e o preenchimento, nao de efeito.
export function ProgressBar({ progress, accessibilityLabel, height = 4 }: Props) {
  const seguro = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const pct = `${Math.round(seguro * 100)}%` as const;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(seguro * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View testID="progress-fill" style={{ width: pct, height: '100%', backgroundColor: color.text, borderRadius: height / 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: color.surface2, overflow: 'hidden' },
});
