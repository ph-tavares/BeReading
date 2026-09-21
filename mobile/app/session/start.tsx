// Quanto tempo (BER-122, spec §3.1, artboard 3). A porta de entrada da sessao
// de leitura: o leitor escolhe um tempo, confirma o livro e comeca.
//
// O que NAO tem aqui, de proposito: nada de 25 minutos por causa do Pomodoro.
// Nao existe ensaio que sustente esse numero, e o estudo disponivel mostra que
// o numero nao importa (blocos de 24/6 e de 12/3 deram praticamente igual em
// fadiga, distracao e concentracao). O que ganha e ter estrutura definida
// ANTES de comecar, que e o que estes atalhos entregam.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { ArrowLeftRight, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { getStudentBooks } from '../../src/api/queries';
import { Screen, Button, Chip, Cover, Field, ListRow, Text } from '../../src/ui';
import { color, radius, space } from '../../src/theme/tokens';
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
  const { lastMode, keepAwake, showTimer, begin, setKeepAwake, setShowTimer } = useSessionStore();

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
    // Falhar aqui nao derruba a sessao, mas tem de aparecer. Em 21/09 o som
    // de inicio nao tocava e o log do Metro estava limpo, porque estas tres
    // chamadas engoliam o erro num catch vazio — a guarda
    // __tests__/guards/erros-da-sessao.test.ts existe por causa disso.
    await configureSessionAudio().catch((e) => console.error('Falha ao configurar o audio da sessao:', e));
    await playStartSound().catch((e) => console.error('Falha ao tocar o som de inicio:', e));
    await armEndAlarm(sessao).catch((e) => console.error('Falha ao armar a notificacao de fim:', e));

    router.replace('/session');
  }, [livroId, modo, begin, router]);

  const selecionado = livros?.find((e) => e.book.id === livroId) ?? currentBook ?? null;
  const livroSelecionado = selecionado?.book ?? null;

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
      <Screen title="Quanto tempo" onClose={() => router.back()} edges={['bottom']} contentStyle={styles.content}>
        {/* O livro e um cartao inteiro tocavel, com a capa e um "Trocar"
            que parece botao. Antes era um texto solto com um link fantasma
            no canto, e ninguem achava que dava para trocar. */}
        {livroSelecionado ? (
          <View style={styles.livroBloco}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Livro: ${livroSelecionado.title}. Trocar livro`}
              accessibilityState={{ expanded: trocando }}
              onPress={() => setTrocando((v) => !v)}
              style={({ pressed }) => [styles.livro, pressed ? styles.livroPressionado : null]}
            >
              <Cover book={livroSelecionado} size="xs" />
              <View style={styles.livroTextos}>
                <Text variant="caption" tone="tertiary">Você vai ler</Text>
                <Text variant="subhead" numberOfLines={2}>{livroSelecionado.title}</Text>
              </View>
              <View style={[styles.trocar, trocando ? styles.trocarAberto : null]}>
                <ArrowLeftRight size={14} color={trocando ? color.brandInk : color.text} strokeWidth={2.2} />
                <Text variant="label" tone={trocando ? 'brandInk' : 'primary'}>Trocar</Text>
              </View>
            </Pressable>

            {trocando && livros ? (
              <View style={styles.lista}>
                {livros.map((e, indice) => (
                  <ListRow
                    key={e.book.id}
                    title={e.book.title}
                    subtitle={e.book.author ?? undefined}
                    trailing={e.book.id === livroId
                      ? <Check size={18} color={color.brandText} strokeWidth={2.4} />
                      : null}
                    last={indice === livros.length - 1}
                    onPress={() => { setLivroId(e.book.id); setTrocando(false); }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.secao}>
          <Text variant="label" tone="secondary">Por quanto tempo</Text>
          <View style={styles.grade}>
            {TIME_PRESETS.minutes.map((minutos) => (
              <View key={minutos} style={styles.celula}>
                <Chip
                  label={`${minutos} min`}
                  selected={escolha.kind === 'preset' && escolha.minutes === minutos}
                  onPress={() => setEscolha({ kind: 'preset', minutes: minutos })}
                />
              </View>
            ))}
          </View>
          <View style={styles.grade}>
            <View style={styles.celula}>
              <Chip
                label="Outro"
                selected={escolha.kind === 'custom'}
                onPress={() => setEscolha({ kind: 'custom' })}
              />
            </View>
            <View style={styles.celulaLarga}>
              <Chip
                label="Sem tempo definido"
                selected={escolha.kind === 'open'}
                onPress={() => setEscolha({ kind: 'open' })}
              />
            </View>
          </View>
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
        <View style={styles.opcoes}>
          {/* BER-123 (spec S17): o padrao mostra o cronometro; desligar da a
              tela calma, sem numero, com o tempo aparecendo so ao toque. */}
          <Opcao
            titulo="Mostrar o cronômetro"
            detalhe="Desligado, a tela fica calma e o tempo aparece ao toque."
            valor={showTimer}
            onChange={(valor) => { void setShowTimer(valor); }}
          />
          <Opcao
            titulo="Manter a tela acesa"
            detalhe="Gasta mais bateria, e o sino do fim chega na hora."
            valor={keepAwake}
            onChange={(valor) => { void setKeepAwake(valor); }}
          />
        </View>

      {semLivro ? (
          <Button onPress={() => router.push('/(tabs)/catalogo')}>Escolher um livro</Button>
        ) : (
          <Button onPress={comecar} disabled={!modo || !livroId}>Começar a ler</Button>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Uma linha com interruptor. A linha inteira alterna, nao so a chave. */
function Opcao({ titulo, detalhe, valor, onChange }: {
  titulo: string; detalhe: string; valor: boolean; onChange: (valor: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      style={styles.opcao}
    >
      <View style={styles.opcaoTextos}>
        <Text variant="subhead">{titulo}</Text>
        <Text variant="caption" tone="tertiary">{detalhe}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        trackColor={{ false: color.surface3, true: color.brand }}
        thumbColor={color.text}
        ios_backgroundColor={color.surface3}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.xl },
  livroBloco: {
    borderRadius: radius.card,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  livro: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  livroPressionado: { backgroundColor: color.surface2 },
  livroTextos: { flex: 1, minWidth: 0, gap: 2 },
  trocar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.surface3,
  },
  trocarAberto: { backgroundColor: color.brand },
  lista: { paddingHorizontal: space.md, borderTopWidth: 1, borderTopColor: color.line },
  secao: { gap: space.sm },
  grade: { flexDirection: 'row', gap: space.sm },
  celula: { flex: 1 },
  celulaLarga: { flex: 2 },
  opcoes: { gap: space.lg },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  opcaoTextos: { flex: 1, gap: 2 },
});
