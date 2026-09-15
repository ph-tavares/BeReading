// Mapa de constancia de 12 semanas (spec 7.9). Substitui o grafico de 14 dias:
// o que importa e o habito, nao o volume de um dia. Colunas sao semanas, linhas
// sao dias (segunda em cima). Para o leitor de tela, uma frase so.
//
// A celula sai da largura real (onLayout): com tamanho fixo, o mapa ocupava so
// metade da tela no teste em emulador de 15/09.
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { color, space } from '../../theme/tokens';
import { readDaysIn, type ConstancyDay } from './logic';

const CELULA_MINIMA = 14;
const CELULA_MAXIMA = 28;
const VAO = space.xs;

export function ConstancyMap({ weeks }: { weeks: ConstancyDay[][] }) {
  const [largura, setLargura] = useState(0);
  const dias = readDaysIn(weeks);

  const colunas = weeks.length;
  const livre = largura - VAO * (colunas - 1);
  const celula = largura > 0
    ? Math.min(CELULA_MAXIMA, Math.max(CELULA_MINIMA, Math.floor(livre / colunas)))
    : CELULA_MINIMA;

  function medir(e: LayoutChangeEvent) {
    setLargura(e.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={medir}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${dias} ${dias === 1 ? 'dia' : 'dias'} com leitura nas últimas ${weeks.length} semanas`}
      style={styles.grade}
    >
      {weeks.map((semana) => (
        <View key={semana[0].date} style={styles.coluna}>
          {semana.map((dia) => (
            <View
              key={dia.date}
              testID={dia.read ? 'constancia-lido' : undefined}
              style={[
                styles.celula,
                { width: celula, height: celula },
                dia.read ? styles.lido : dia.future ? styles.futuro : styles.vazio,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', justifyContent: 'space-between' },
  coluna: { gap: VAO },
  celula: { borderRadius: 3 },
  lido: { backgroundColor: color.accent },
  vazio: { backgroundColor: color.surface2 },
  futuro: { backgroundColor: color.surface1 },
});
