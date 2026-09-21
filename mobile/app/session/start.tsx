// Quanto tempo (BER-122, spec §3.1, artboard 3). A porta de entrada da sessao
// de leitura: o leitor escolhe um tempo, confirma o livro e comeca.
//
// O que NAO tem aqui, de proposito: nada de 25 minutos por causa do Pomodoro.
// Nao existe ensaio que sustente esse numero, e o estudo disponivel mostra que
// o numero nao importa (blocos de 24/6 e de 12/3 deram praticamente igual em
// fadiga, distracao e concentracao). O que ganha e ter estrutura definida
// ANTES de comecar, que e o que estes atalhos entregam.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { getStudentBooks } from '../../src/api/queries';
import { Screen, Button, Chip, Field, ListRow, Text } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { TIME_PRESETS, parseCustomMinutes, type SessionMode } from '../../src/features/session/logic';
import { configureSessionAudio, playStartSound } from '../../src/features/session/audio';
import { armEndAlarm } from '../../src/features/session/alarm';
import type { Book, StudentBook } from '../../src/types/database';

type Entry = StudentBook & { book: Book };

/** Qual bloco de tempo esta marcado. `custom` abre o campo de minutos. */
type Escolha = { kind: 'preset'; minutes: number } | { kind: 'custom' } | { kind: 'open' };

function escolhaInicial(ultimo: SessionMode): Escolha {
  if (ultimo.kind === 'open') return { kind: 'open' };
  return TIME_PRESETS.minutes.includes(ultimo.minutes as never)
    ? { kind: 'preset', minutes: ultimo.minutes }
    : { kind: 'custom' };
}

export default function SessionStartScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { currentBook } = useReadingStore();
  const { lastMode, keepAwake, begin, setKeepAwake } = useSessionStore();

  const [escolha, setEscolha] = useState<Escolha>(() => escolhaInicial(lastMode));
  const [minutosDigitados, setMinutosDigitados] = useState(
    lastMode.kind === 'timed' ? String(lastMode.minutes) : '',
  );
  const [livros, setLivros] = useState<Entry[] | null>(null);
  const [livroId, setLivroId] = useState<string | null>(currentBook?.book.id ?? null);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let vivo = true;
    getStudentBooks(profile.user_id)
      .then((entradas: Entry[]) => {
        if (!vivo) return;
        setLivros(entradas);
        // O livro atual ja vem selecionado. Sem um corrente, o primeiro em
        // leitura serve: a tela nao existe para escolher livro, existe para
        // escolher tempo.
        setLivroId((atual) => atual ?? entradas[0]?.book.id ?? null);
      })
      .catch(() => { if (vivo) setLivros([]); });
    return () => { vivo = false; };
  }, [profile]);

  /**
   * O tempo que vale, ou `null` quando o que esta na tela nao da uma sessao.
   * Um so lugar decide isso, e o botao le dele: se o campo personalizado esta
   * vazio ou com bobagem, nao ha o que comecar.
   */
  const modo: SessionMode | null =
    escolha.kind === 'open'
      ? { kind: 'open' }
      : escolha.kind === 'preset'
        ? { kind: 'timed', minutes: escolha.minutes }
        : (() => {
          const minutos = parseCustomMinutes(minutosDigitados);
          return minutos === null ? null : { kind: 'timed' as const, minutes: minutos };
        })();

  const comecar = useCallback(async () => {
    if (!livroId || !modo) return;
    const sessao = await begin({ mode: modo, bookId: livroId });

    // BER-124, as duas camadas do som, armadas junto com a sessao.
    //
    // O modo de audio vem ANTES de tocar qualquer coisa: sem
    // `playsInSilentMode` e `shouldPlayInBackground`, o sino do FIM nao toca
    // no unico caso que importa, que e o celular no silencioso com a tela
    // apagada. Configurar so na hora de tocar o fim seria tarde: o app ja
    // esta congelado.
    //
    // Nenhuma das duas derruba a sessao se falhar. A sessao ja esta gravada,
    // e o instante do fim tambem — quem depende do som e o conforto, nao a
    // corretude (BER-122).
    await configureSessionAudio().catch(() => {});
    await playStartSound().catch(() => {});
    await armEndAlarm(sessao).catch(() => {});

    router.replace('/session');
  }, [livroId, modo, begin, router]);

  const selecionado = livros?.find((e) => e.book.id === livroId) ?? currentBook ?? null;
  const tituloSelecionado = selecionado
    ? ('book' in selecionado ? selecionado.book.title : null)
    : null;

  // Estante vazia: a tela NAO pode dar em nada. Ela oferece escolher um livro
  // em vez de mostrar um botao que nao faz nada — e tambem nao deixa comecar
  // sem livro, porque o fim da sessao pergunta ate que pagina se foi, e pagina
  // sem livro nao registra leitura nenhuma.
  const semLivro = livros !== null && livroId === null;

  // O KeyboardAvoidingView envolve o Screen, e nao o contrario: com
  // `behavior="padding"` o RN mede a partir do topo da janela, entao abrir
  // depois do cabecalho do Screen deixa faltar exatamente a altura dele por
  // baixo do teclado. Foi a BER-121, achada em aparelho com a suite verde.
  // `__tests__/guards/teclado.test.ts` trava esta ordem.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Quanto tempo" onBack={() => router.back()} contentStyle={styles.content}>
        {tituloSelecionado ? (
          <View style={styles.livro}>
            <Text variant="body" tone="secondary">{tituloSelecionado}</Text>
            <Button variant="ghost" onPress={() => setTrocando((v) => !v)}>Trocar</Button>
          </View>
        ) : null}

        {trocando && livros ? (
          <View>
            {livros.map((e, indice) => (
              <ListRow
                key={e.book.id}
                title={e.book.title}
                subtitle={e.book.author ?? undefined}
                last={indice === livros.length - 1}
                onPress={() => { setLivroId(e.book.id); setTrocando(false); }}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.atalhos}>
          {TIME_PRESETS.minutes.map((minutos) => (
            <Chip
              key={minutos}
              label={`${minutos} min`}
              selected={escolha.kind === 'preset' && escolha.minutes === minutos}
              onPress={() => setEscolha({ kind: 'preset', minutes: minutos })}
            />
          ))}
          <Chip
            label="Outro"
            selected={escolha.kind === 'custom'}
            onPress={() => setEscolha({ kind: 'custom' })}
          />
          <Chip
            label="Sem tempo definido"
            selected={escolha.kind === 'open'}
            onPress={() => setEscolha({ kind: 'open' })}
          />
        </View>

        {escolha.kind === 'custom' ? (
          <Field
            label="Tempo"
            placeholder="minutos"
            keyboardType="number-pad"
            value={minutosDigitados}
            onChangeText={setMinutosDigitados}
            error={minutosDigitados !== '' && parseCustomMinutes(minutosDigitados) === null
              ? `Entre 1 e ${TIME_PRESETS.maxCustomMinutes} minutos.`
              : undefined}
          />
        ) : null}

          {/* Terceira camada do som (BER-124). Fica aqui, e nao na tela da
            sessao, porque a BER-123 fecha aquela tela em "so o tempo, o livro
            e tres botoes": um quarto controla la brigaria com o contrato.
            Aqui e' antes de comecar, junto das outras escolhas. */}
        <Chip
          label="Manter a tela acesa"
          selected={keepAwake}
          onPress={() => { void setKeepAwake(!keepAwake); }}
        />

      {semLivro ? (
          <Button onPress={() => router.push('/(tabs)/catalogo')}>Escolher um livro</Button>
        ) : (
          <Button onPress={comecar} disabled={!modo || !livroId}>Começar a ler</Button>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.xl },
  livro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
