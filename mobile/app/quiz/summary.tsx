// Resumo do quiz (spec 7.6, F5 Tarefa 6). Honesto: a fala sai da faixa da media
// real (scoreLine), o XP e a soma das respostas avaliadas, e resposta pendente
// fica fora da media e aparece como "avaliando" (BER-42). Sai o sistema antigo:
// confete, "quest", "saga" e "feedback do mestre".
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { getChaptersByIds, loadQuizForReader } from '../../src/api/queries';
import { ASSISTANT_NAME } from '../../src/assistant/persona';
import { chapterUnderstoodTitle, scoreLine } from '../../src/assistant/lines';
import { Button, Glyph, ListRow, Ring, Screen, Tag, Text } from '../../src/ui';
import { answeredXp } from '../../src/features/quiz-chat';
import { space } from '../../src/theme/tokens';
import type { QuestionResult } from '../../src/utils/quizUtils';

type Recap = { texto: string; resultado: QuestionResult | null }[];

const TAMANHO_DO_ANEL = 112; // Documentado em src/ui/Ring.tsx: 112 no resumo.

export default function QuizSummaryScreen() {
  // `total` segue no contrato da rota do quiz; a tela nao precisa mais dele.
  const { avgScore, pending, chapterId } = useLocalSearchParams<{
    avgScore: string;
    total: string;
    pending?: string;
    chapterId?: string;
  }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const userId = profile?.user_id ?? null;

  const [numero, setNumero] = useState<number | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);

  // BER-42: `avgScore` chega vazio quando nenhuma resposta foi avaliada ainda.
  // Vazio nao e zero: a media so aparece quando existe de fato.
  const lido = parseInt(avgScore ?? '', 10);
  const media = Number.isNaN(lido) ? null : lido;
  const pendentes = parseInt(pending ?? '0', 10) || 0;

  useEffect(() => {
    if (!chapterId || !userId) return;
    let cancelado = false;
    // Sem o numero ou sem o recap a tela segue: titulo sem numero, sem lista.
    Promise.all([
      getChaptersByIds([chapterId]).catch(() => null),
      loadQuizForReader(chapterId, userId).catch(() => null),
    ]).then(([capitulos, quiz]) => {
      if (cancelado) return;
      setNumero(capitulos?.[0]?.number ?? null);
      if (quiz) {
        setRecap(quiz.questions.map((q, i) => ({ texto: q.question_text, resultado: quiz.progress.results[i] ?? null })));
      }
    });
    return () => {
      cancelado = true;
    };
  }, [chapterId, userId]);

  const xp = recap ? answeredXp(recap.flatMap((item) => (item.resultado ? [item.resultado] : []))) : null;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={styles.quem}>
        <Glyph />
        <Text variant="label" tone="accent">{ASSISTANT_NAME}</Text>
      </View>
      <Text variant="title">{chapterUnderstoodTitle(numero)}</Text>
      <Text variant="callout" tone="secondary">{scoreLine(media)}</Text>

      <View style={styles.anel}>
        <Ring
          progress={media === null ? 0 : media / 100}
          size={TAMANHO_DO_ANEL}
          accessibilityLabel={media === null ? 'Média ainda sendo avaliada' : `Média ${media} de 100`}
        >
          {media === null
            ? <Text variant="caption" tone="tertiary">avaliando</Text>
            : <Text variant="numericL">{String(media)}</Text>}
        </Ring>
        {xp !== null ? <Tag label={`+${xp} XP`} tone="accent" /> : null}
      </View>

      {pendentes > 0 ? (
        <Text variant="caption" tone="tertiary">
          {pendentes === 1
            ? '1 resposta ainda está sendo avaliada e não entrou na média.'
            : `${pendentes} respostas ainda estão sendo avaliadas e não entraram na média.`}
        </Text>
      ) : null}

      {recap ? (
        <View>
          {recap.map((item, i) => (
            <ListRow
              key={`${i}-${item.texto}`}
              title={item.texto}
              last={i === recap.length - 1}
              trailing={
                <Tag label={typeof item.resultado?.score === 'number' ? String(item.resultado.score) : 'avaliando'} />
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.acoes}>
        <Button onPress={() => router.replace('/')}>Continuar lendo</Button>
        {chapterId ? (
          <Button variant="ghost" onPress={() => router.replace(`/quiz/${chapterId}`)}>Rever a conversa</Button>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingTop: space.xl, paddingBottom: space.xl },
  quem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  anel: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  acoes: { gap: space.sm, marginTop: space.md },
});
