// Capitulo fechado (spec S7.3, F4 Tarefa 6): substitui o Alert.alert("Capitulo
// completo!") antigo, no momento mais importante do produto. A apresentacao
// (fullScreenModal) e configurada em app/_layout.tsx.
//
// Aqui ficam dado e navegacao; a composicao vem de src/features/chapter-complete.
// O XP sai do progressStore, que o sheet de registrar leitura recalcula antes de
// navegar pra ca (spec S7.2 e S8). Os numeros dos capitulos saem do banco,
// porque os params so trazem ids (F4-15).
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProgressStore } from '../src/stores/progressStore';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { getChaptersByIds } from '../src/api/queries';
import { quizInviteLine } from '../src/assistant/lines';
import { Button, Screen } from '../src/ui';
import { backOrHome } from '../src/utils/navigation';
import {
  ChapterCompleteSkeleton, ClosedChapterHeader, GainTags, XpRing, chapterCompleteLayout,
  chapterTargets, closedTitle, parseParams, quizCta, streakTagLabel, xpGained, xpPlan, xpTagLabel,
  type ChapterCompleteRawParams,
} from '../src/features/chapter-complete';
import type { Chapter } from '../src/types/database';
import type { Entitlement } from '../src/utils/billing';

type Carga =
  | { estado: 'carregando' }
  | { estado: 'pronto'; capitulos: Chapter[] | null; plano: Entitlement | null };

export default function ChapterCompleteScreen() {
  const router = useRouter();
  const bruto = useLocalSearchParams<ChapterCompleteRawParams>();

  // Lidos uma vez, na montagem. Os params de uma rota montada nao mudam, e o XP
  // fica congelado de proposito: um refresh no meio da tela mudaria o alvo e
  // reiniciaria a contagem.
  const [params] = useState(() => parseParams(bruto));
  const [progresso] = useState(() => {
    const { xp, level, carregado } = useProgressStore.getState();
    return { xp, level, carregado };
  });

  const ids = params.chapterIds;
  const [carga, setCarga] = useState<Carga>(() =>
    ids.length > 0 ? { estado: 'carregando' } : { estado: 'pronto', capitulos: null, plano: null },
  );

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelado = false;
    // O plano vem junto dos capitulos (BER-58): o CTA so aparece quando os dois
    // chegaram, para "Bora pro quiz" nao virar "Conhecer o Premium" na frente do
    // leitor. `refresh` devolve null em falha, e sem plano o quiz abre: a tela
    // do quiz tem o estado de cota como rede.
    Promise.all([
      // F4-15: sem os numeros a tela segue, sem inventar nenhum.
      getChaptersByIds(ids).catch(() => null),
      useEntitlementStore.getState().refresh(),
    ]).then(([capitulos, plano]) => {
      if (!cancelado) setCarga({ estado: 'pronto', capitulos, plano });
    });
    return () => {
      cancelado = true;
    };
  }, [ids]);

  // back, nunca replace da pilha: volta pra onde o leitor abriu o registro. Existe
  // tambem durante o carregamento (F4-26): sair nao depende dos capitulos, e uma
  // consulta pendurada deixaria o leitor num fullScreenModal sem saida no iOS.
  // Sem tela atras (link direto, recarregamento), vai para a Hoje: `back()` sem
  // destino deixaria o leitor preso na conquista (R2, 15/09).
  const depois = <Button variant="ghost" onPress={() => backOrHome(router)}>Depois</Button>;

  if (carga.estado === 'carregando') {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <ChapterCompleteSkeleton>{depois}</ChapterCompleteSkeleton>
      </Screen>
    );
  }

  const alvos = chapterTargets(ids, carga.capitulos);
  const cta = quizCta(alvos.quizChapterId, carga.plano);
  const plano = xpPlan({
    xpBefore: params.xpBefore,
    gained: xpGained(params.pagesRead) ?? 0,
    storeXp: progresso.xp,
    storeLevel: progresso.level,
    loaded: progresso.carregado,
  });

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={chapterCompleteLayout.corpo}>
        <ClosedChapterHeader
          title={closedTitle(alvos.numbers, ids.length)}
          invite={cta.kind === 'quiz' ? quizInviteLine() : cta.kind === 'premium' ? cta.line : null}
        />
        {plano ? <XpRing plan={plano} /> : null}
        <GainTags xp={xpTagLabel(params.pagesRead)} streak={streakTagLabel(params.streak)} />
      </View>
      <View style={chapterCompleteLayout.acoes}>
        {/* replace: a conquista nao fica na pilha atras do quiz nem dos planos. */}
        {cta.kind === 'quiz' ? (
          <Button onPress={() => router.replace(`/quiz/${cta.chapterId}`)}>Bora pro quiz</Button>
        ) : null}
        {cta.kind === 'premium' ? (
          <Button onPress={() => router.replace('/planos')}>Conhecer o Premium</Button>
        ) : null}
        {depois}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A moldura (miolo no centro, botoes embaixo) precisa da altura inteira.
  content: { flexGrow: 1 },
});
