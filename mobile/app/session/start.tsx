// Quanto tempo (BER-122, spec §3.1, artboard 3). A porta de entrada da sessao
// de leitura: o leitor escolhe um tempo, confirma o livro e comeca.
//
// O que NAO tem aqui, de proposito: nada de 25 minutos por causa do Pomodoro.
// Nao existe ensaio que sustente esse numero, e o estudo disponivel mostra que
// o numero nao importa — blocos de 24/6 e de 12/3 deram praticamente igual em
// fadiga, distracao e concentracao. O que ganha e' ter estrutura definida
// ANTES de comecar, que e o que estes atalhos entregam.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useReadingStore } from '../../src/stores/readingStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { Screen, Button, Chip, Text } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { TIME_PRESETS, type SessionMode } from '../../src/features/session/logic';

/** O rotulo do atalho de tempo. Um lugar so, usado pelo chip e pelo teste. */
function rotuloDoPreset(minutos: number): string {
  return `${minutos} min`;
}

export default function SessionStartScreen() {
  const router = useRouter();
  const { currentBook } = useReadingStore();
  const { lastMode, begin } = useSessionStore();

  const [modo, setModo] = useState<SessionMode>(lastMode);

  const livroId = currentBook?.book.id ?? null;

  async function comecar() {
    if (!livroId) return;
    await begin({ mode: modo, bookId: livroId });
    router.replace('/session');
  }

  return (
    <Screen title="Quanto tempo" onBack={() => router.back()} contentStyle={styles.content}>
      {currentBook ? (
        <Text variant="body" tone="secondary">{currentBook.book.title}</Text>
      ) : null}

      <View style={styles.atalhos}>
        {TIME_PRESETS.minutes.map((minutos) => (
          <Chip
            key={minutos}
            label={rotuloDoPreset(minutos)}
            selected={modo.kind === 'timed' && modo.minutes === minutos}
            onPress={() => setModo({ kind: 'timed', minutes: minutos })}
          />
        ))}
        <Chip
          label="Sem tempo definido"
          selected={modo.kind === 'open'}
          onPress={() => setModo({ kind: 'open' })}
        />
      </View>

      <Button onPress={comecar} disabled={!livroId}>Começar a ler</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
