import { View } from 'react-native';
import { colors } from '../theme/tokens';

interface Props {
  /** Valor entre 0 e 1 */
  progress: number;
  height?: number;
  color?: string;
  colorDeep?: string;
  showShine?: boolean;
}

export function ProgressBar({
  progress,
  height = 10,
  color = colors.green,
  colorDeep = colors.greenDeep,
  showShine = true,
}: Props) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={{
      width: '100%',
      height,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: height,
      overflow: 'hidden',
    }}>
      <View style={{
        width: `${pct}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: height,
        borderBottomWidth: pct > 0 ? Math.max(2, height / 4) : 0,
        borderBottomColor: colorDeep,
        position: 'relative',
      }}>
        {showShine && pct > 0 && (
          <View style={{
            position: 'absolute',
            top: 1,
            left: 4,
            right: 4,
            height: Math.max(2, height / 3),
            borderRadius: height,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }} />
        )}
      </View>
    </View>
  );
}
