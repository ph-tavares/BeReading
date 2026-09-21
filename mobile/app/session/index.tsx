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
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSessionStore } from '../../src/stores/sessionStore';
import { Screen, Button, Text } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { elapsedMs, remainingMs, formatClock, isFinished } from '../../src/features/session/logic';
import { playEndSound } from '../../src/features/session/audio';

export default function SessionScreen() {
  const router = useRouter();
  const { active, keepAwake } = useSessionStore();

  // Nao guarda o tempo: guarda um contador que so serve para forcar o
  // repintar. O tempo sai sempre de `active` mais o relogio do sistema.
  const [, repintar] = useState(0);

  /**
   * BER-124: o sino do fim toca UMA vez.
   *
   * Sem esta trava ele tocaria a cada segundo depois do fim, porque a
   * condicao que o dispara e "o instante gravado ja passou" — e ela continua
   * verdadeira para sempre. Ref, e nao estado: tocar o som nao repinta nada, e
   * um `setState` aqui so provocaria render a mais.
   */
  const tocou = useRef(false);

  // Terceira camada do som (BER-124): so liga se o leitor pediu. Manter a tela
  // acesa gasta bateria, entao nao e padrao — e a garantia de quem nao quer
  // depender de sino nenhum.
  useEffect(() => {
    if (!active || !keepAwake) return;
    void activateKeepAwakeAsync().catch((e) => console.error('Falha ao manter a tela acesa:', e));
    return () => { try { deactivateKeepAwake(); } catch { /* nada a fazer */ } };
  }, [active, keepAwake]);

  useEffect(() => {
    if (!active) return;

    const conferir = () => {
      repintar((n) => n + 1);
      if (!tocou.current && isFinished(active)) {
        tocou.current = true;
        // Falhar aqui nao derruba a sessao: o instante do fim esta gravado e
        // a duracao continua certa sem som nenhum (BER-122). A notificacao
        // local e a rede embaixo deste sino.
        void playEndSound().catch((e) => console.error('Falha ao tocar o som de fim:', e));
      }
    };

    const id = setInterval(conferir, 1000);
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
