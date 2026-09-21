// A sessao correndo (BER-122 e BER-123, spec §3.2, artboards 4 e 5).
//
// So o tempo, o livro e tres acoes: pausar, encerrar e o assistente. Nenhum
// numero de jogo (XP, nivel, sequencia): durante a leitura nao e hora de
// pontuar.
//
// A regra que manda: o numero NAO vem de um contador acumulado. Ele e'
// recalculado a cada segundo a partir do instante gravado no inicio da sessao
// (src/features/session/logic.ts). O tique existe so para a tela repintar —
// se ele parar, porque o app foi congelado com a tela apagada, o numero volta
// certo assim que a tela reaparece. "O cronometro reinicia quando a tela
// apaga" e' reclamacao de loja registrada do concorrente Leio.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Pause, Play, ScanText } from 'lucide-react-native';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getStudentBooks } from '../../src/api/queries';
import { Screen, Button, Cover, IconButton, Text } from '../../src/ui';
import { color, radius, space } from '../../src/theme/tokens';
import {
  elapsedMs, remainingMs, formatClock, isFinished, isPaused,
} from '../../src/features/session/logic';
import { playEndSound, playStopSound } from '../../src/features/session/audio';
import { armEndAlarm, disarmEndAlarm } from '../../src/features/session/alarm';
import type { Book } from '../../src/types/database';

/**
 * A tela calma (spec S17) nao e vazia: uma frase curta ocupa o lugar do
 * numero. Nenhuma fala de meta ou de pontos, pelo mesmo motivo de nao haver
 * XP aqui.
 */
const FRASES_CALMAS = [
  'Só você e o livro agora.',
  'Sem pressa. A página espera.',
  'O tempo está contando por você.',
  'Se a cabeça fugir, volte uma linha e siga.',
];

/** Quanto tempo o numero fica a mostra depois de um toque na tela calma. */
const REVELAR_MS = 4000;
/** De quanto em quanto tempo a frase da tela calma muda. */
const TROCA_FRASE_MS = 30_000;

export default function SessionScreen() {
  const router = useRouter();
  const { active, keepAwake, showTimer, pause, resume, end } = useSessionStore();
  const { currentBook } = useReadingStore();
  const { profile } = useAuthStore();

  // Nao guarda o tempo: guarda um contador que so serve para forcar o
  // repintar. O tempo sai sempre de `active` mais o relogio do sistema.
  const [tique, repintar] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [livro, setLivro] = useState<Pick<Book, 'id' | 'title' | 'author' | 'cover_url'> | null>(
    currentBook && active && currentBook.book.id === active.bookId ? currentBook.book : null,
  );

  /**
   * BER-124: o sino do fim toca UMA vez.
   *
   * Sem esta trava ele tocaria a cada segundo depois do fim, porque a
   * condicao que o dispara e "o instante gravado ja passou" — e ela continua
   * verdadeira para sempre. Ref, e nao estado: tocar o som nao repinta nada, e
   * um `setState` aqui so provocaria render a mais.
   */
  const tocou = useRef(false);

  // O livro da sessao nem sempre e o da Hoje (a tela de inicio deixa trocar).
  useEffect(() => {
    if (!active || livro?.id === active.bookId || !profile) return;
    let vivo = true;
    getStudentBooks(profile.user_id)
      .then((entradas: { book: Book }[]) => {
        const achado = entradas.find((e) => e.book.id === active.bookId);
        if (vivo && achado) setLivro(achado.book);
      })
      .catch((e: unknown) => console.error('Falha ao carregar o livro da sessao:', e));
    return () => { vivo = false; };
  }, [active, livro, profile]);

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

  // O numero revelado na tela calma some sozinho: e uma espiada, nao um modo.
  useEffect(() => {
    if (!revelado) return;
    const id = setTimeout(() => setRevelado(false), REVELAR_MS);
    return () => clearTimeout(id);
  }, [revelado]);

  if (!active) {
    // Sem sessao nao ha o que mostrar. Acontece ao voltar para a rota depois
    // de encerrar, e quando a sessao e' limpa por outra tela.
    return (
      <Screen title="Sessão" onBack={() => router.replace('/')}>
        <Text variant="body" tone="secondary">Nenhuma leitura em andamento.</Text>
      </Screen>
    );
  }

  const pausada = isPaused(active);
  const acabou = isFinished(active);
  const falta = remainingMs(active);
  const relogio = falta === null ? formatClock(elapsedMs(active)) : formatClock(falta);
  const legenda = pausada
    ? 'Pausado'
    : acabou
      ? 'Tempo concluído'
      : falta === null ? 'lendo há' : 'restante';
  const mostraNumero = showTimer || revelado || pausada || acabou;
  const frase = FRASES_CALMAS[Math.floor((tique * 1000) / TROCA_FRASE_MS) % FRASES_CALMAS.length];

  // Pausar desarma o sino (nao ha fim enquanto parado); retomar arma de novo
  // no fim empurrado. Nenhuma das duas derruba a sessao se falhar.
  const alternarPausa = async () => {
    if (pausada) {
      const retomada = await resume();
      if (retomada) await armEndAlarm(retomada).catch((e) => console.error('Falha ao rearmar o fim:', e));
    } else {
      await pause();
      await disarmEndAlarm().catch((e) => console.error('Falha ao desarmar o fim:', e));
    }
  };

  // O fim da sessao e a pergunta "ate que pagina voce foi?" (spec §3.3, S3):
  // encerrar leva direto ao registro, com o livro da sessao ja escolhido.
  // Encerrar antes do tempo nao e fracasso, entao nada de tela de derrota.
  const encerrar = async () => {
    const bookId = active.bookId;
    if (!tocou.current) {
      tocou.current = true;
      await playStopSound().catch((e) => console.error('Falha ao encerrar o som da sessao:', e));
    }
    await end().catch((e) => console.error('Falha ao limpar a sessao:', e));
    router.replace({ pathname: '/register-reading', params: { bookId } });
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={styles.topo}>
        {livro ? (
          <View style={styles.livro}>
            <Cover book={livro} size="xs" />
            <View style={styles.livroTextos}>
              <Text variant="caption" tone="tertiary">Lendo</Text>
              <Text variant="subhead" numberOfLines={2}>{livro.title}</Text>
            </View>
          </View>
        ) : <View style={styles.livro} />}
        {/* O lugar do assistente (BER-123). A BER-100 ja existe, entao ele
            abre a camera com o livro da sessao em vez de nascer desabilitado. */}
        <IconButton
          icon={ScanText}
          accessibilityLabel="Perguntar ao assistente sobre a página"
          onPress={() => router.push({
            pathname: '/assistant/scan',
            params: livro ? { bookId: livro.id, bookTitle: livro.title } : {},
          })}
          style={styles.redondo}
        />
      </View>

      <Pressable
        style={styles.centro}
        accessibilityRole={mostraNumero ? undefined : 'button'}
        accessibilityLabel={mostraNumero ? undefined : 'Mostrar o tempo'}
        onPress={mostraNumero ? undefined : () => setRevelado(true)}
      >
        {mostraNumero ? (
          <>
            <Text
              variant="numericHero"
              style={pausada ? styles.relogioPausado : undefined}
              accessibilityLabel={`${legenda} ${relogio}`}
            >
              {relogio}
            </Text>
            <Text variant="label" tone={acabou ? 'brand' : 'tertiary'}>{legenda}</Text>
          </>
        ) : (
          <>
            <Text variant="heading" align="center" style={styles.frase}>{frase}</Text>
            <Text variant="caption" tone="tertiary">Toque para ver o tempo</Text>
          </>
        )}

        {acabou ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pausada ? 'Retomar' : 'Pausar'}
            onPress={() => { void alternarPausa(); }}
            style={({ pressed }) => [styles.pausa, pausada ? styles.pausaAtiva : null, pressed ? styles.pressionado : null]}
          >
            {pausada
              ? <Play size={28} color={color.brandInk} fill={color.brandInk} strokeWidth={2} />
              : <Pause size={28} color={color.text} fill={color.text} strokeWidth={2} />}
          </Pressable>
        )}
      </Pressable>

      <Button variant={acabou ? 'primary' : 'secondary'} onPress={() => { void encerrar(); }}>
        {acabou ? 'Registrar leitura' : 'Encerrar'}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.lg },
  topo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  livro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  livroTextos: { flex: 1, minWidth: 0, gap: 2 },
  redondo: { borderRadius: radius.pill },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  relogioPausado: { opacity: 0.45 },
  frase: { maxWidth: 280 },
  pausa: {
    marginTop: space.xxl,
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line2,
  },
  pausaAtiva: { backgroundColor: color.brand, borderColor: color.brand },
  pressionado: { transform: [{ scale: 0.96 }] },
});
