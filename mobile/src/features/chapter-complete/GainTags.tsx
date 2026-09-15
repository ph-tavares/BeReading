// O que o registro rendeu (spec S7.3): "+X XP" e "N dias seguidos". Tag, e nao
// Chip, porque e so informacao (DESIGN.md secao 5). O XP em accent, que e o
// ganho da tela (F4-21); a sequencia em neutro, como no mockup, para o ambar
// do anel, do XP e do botao nao disputar com mais um.
import { StyleSheet, View } from 'react-native';
import { Tag } from '../../ui';
import { space } from '../../theme/tokens';

interface Props {
  xp: string | null;
  streak: string | null;
}

export function GainTags({ xp, streak }: Props) {
  if (!xp && !streak) return null;
  return (
    <View style={styles.row}>
      {xp ? <Tag label={xp} tone="accent" /> : null}
      {streak ? <Tag label={streak} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
