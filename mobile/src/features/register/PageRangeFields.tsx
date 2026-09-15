// "De" e "Ate" lado a lado (spec S7.2, mockup 04). O "Ate" abre em foco: em
// quase todo registro o De ja vem certo e a pessoa so digita onde parou.
import { StyleSheet, View } from 'react-native';
import { PageField } from '../../ui/PageField';
import { Text } from '../../ui/Text';
import { space } from '../../theme/tokens';

interface Props {
  start: string;
  end: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  totalPages: number;
  /** Dica embaixo do De, so enquanto ele ainda e o valor pre-preenchido. */
  startHint: string | null;
  /** Trava os dois campos enquanto o registro esta sendo enviado (F4-18). */
  disabled?: boolean;
}

export function PageRangeFields({
  start, end, onChangeStart, onChangeEnd, totalPages, startHint, disabled = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <PageField
          label="De"
          value={start}
          onChange={onChangeStart}
          max={totalPages}
          disabled={disabled}
          accessibilityLabel="Página inicial"
        />
        <PageField
          label="Até"
          value={end}
          onChange={onChangeEnd}
          max={totalPages}
          autoFocus
          disabled={disabled}
          accessibilityLabel="Página final"
        />
      </View>
      {/* Mesma divisao em duas colunas dos campos, para cada dica ficar
          embaixo do seu. */}
      <View style={styles.row}>
        <Text variant="caption" tone="tertiary" style={styles.hint}>{startHint ?? ''}</Text>
        <Text variant="caption" tone="tertiary" style={styles.hint}>{`de ${totalPages}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.md },
  hint: { flex: 1 },
});
