// Moldura da conquista, dividida entre a tela e o skeleton: os dois ocupam o
// mesmo lugar, entao nada salta quando os capitulos chegam.
import { StyleSheet } from 'react-native';
import { space } from '../../theme/tokens';

export const chapterCompleteLayout = StyleSheet.create({
  // O miolo centraliza na altura que sobra; os botoes ficam embaixo.
  corpo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingTop: space.xl },
  acoes: { alignSelf: 'stretch', gap: space.sm, paddingTop: space.xl, paddingBottom: space.lg },
});
