// A sessao correndo (BER-122; o desenho completo e' a BER-123, artboards 4 e 5).
//
// O que existe aqui hoje: o relogio e a saida. O que a BER-123 acrescenta em
// cima: pausar, a tela calma sem numero, e o lugar do assistente.
//
// A regra que manda: o numero NAO vem de um contador acumulado. Ele e'
// recalculado a cada segundo a partir do instante gravado no inicio da sessao
// (src/features/session/logic.ts). O tique existe so para a tela repintar —
// se ele parar, porque o app foi congelado com a tela apagada, o numero volta
// certo assim que a tela reaparece. "O cronometro reinicia quando a tela
// apaga" e' reclamacao de loja registrada do concorrente Leio.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../src/stores/sessionStore';
import { Screen, Button, Text } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { elapsedMs, remainingMs, formatClock } from '../../src/features/session/logic';

export default function SessionScreen() {
  const router = useRouter();
  const { active } = useSessionStore();

  // Nao guarda o tempo: guarda um contador que so serve para forcar o
  // repintar. O tempo sai sempre de `active` mais o relogio do sistema.
  const [, repintar] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => repintar((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) {
    // Sem sessao nao ha o que mostrar. Acontece ao voltar para a rota depois
    // de encerrar, e quando a sessao e' limpa por outra tela.
    return (
      <Screen title="Sessao" onBack={() => router.replace('/')}>
        <Text variant="body" tone="secondary">Nenhuma leitura em andamento.</Text>
      </Screen>
    );
  }

  const falta = remainingMs(active);
  const relogio = falta === null ? formatClock(elapsedMs(active)) : formatClock(falta);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.relogio}>
        <Text variant="display">{relogio}</Text>
      </View>

      <Button variant="secondary" onPress={() => router.replace('/')}>Encerrar</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xxl },
  relogio: { alignItems: 'center', paddingVertical: space.xxl },
});
