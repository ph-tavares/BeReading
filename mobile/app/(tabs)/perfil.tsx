// Voce (spec 7.9, F6 Tarefa 3). Anel com monograma e nivel, tres numeros,
// mapa de constancia de 12 semanas, conquistas com progresso, plano e conta.
// A logica do time continua: plano (BER-61), turma, sair e excluir conta
// (BER-62), agora com Sheet e confirmacao destrutiva do sistema.
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useEntitlementStore } from '../../src/stores/entitlementStore';
import { useProgressStore } from '../../src/stores/progressStore';
import { ProfileErrorState } from '../../src/components/ProfileErrorState';
import { getAllBadges, getStudentBooks } from '../../src/api/queries';
import { deleteAccount } from '../../src/api/edgeFunctions';
import { supabase } from '../../src/lib/supabase';
import { planSummary } from '../../src/utils/billing';
import { effectiveStreak } from '../../src/game/streak';
import { decorateBadges, type DecoratedBadge } from '../../src/game/badges';
import { formatXp } from '../../src/game/xp';
import { Banner, ListRow, Screen, Skeleton, Text, confirmDestructive, useToast } from '../../src/ui';
import {
  BadgeList, BadgeSheet, ClassroomSheet, ConstancyMap, ProfileHeader, StatsRow,
  badgeStatsFrom, constancyWeeks, overallAverage,
} from '../../src/features/profile';
import { color, radius, space } from '../../src/theme/tokens';
import type { Badge } from '../../src/types/database';

const SEM_STREAK = { current_streak: 0, last_read_date: null as string | null };

export default function PerfilScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, profileStatus, clear } = useAuthStore();
  const userId = profile?.user_id ?? null;
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const { sessions, answers, badges, streak, xp, level, refresh } = useProgressStore();

  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [booksFinished, setBooksFinished] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [badgeAberta, setBadgeAberta] = useState<DecoratedBadge | null>(null);
  const [turmaAberta, setTurmaAberta] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const load = useCallback(async (id: string) => {
    setError(false);
    // BER-61: o plano nao segura o resto da tela, carrega em paralelo.
    useEntitlementStore.getState().refresh();
    try {
      const [, todas, livros] = await Promise.all([refresh(id), getAllBadges(), getStudentBooks(id)]);
      setAllBadges(todas);
      setBooksFinished(livros.filter((b) => b.status === 'finished').length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      // BER-45: sem perfil, o carregamento nunca terminaria.
      if (!userId) { setLoading(false); return; }
      load(userId);
    }, [userId, load]),
  );

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId, load]);

  function handleLogout() {
    confirmDestructive({
      title: 'Sair da conta?',
      message: 'Seu progresso fica salvo. É só entrar de novo com seu e-mail e senha.',
      confirmLabel: 'Sair',
      onConfirm: async () => {
        await supabase.auth.signOut();
        clear();
      },
    });
  }

  // BER-62: exigencia de loja e direito de eliminacao (LGPD Art. 18). Confirmacao
  // explicita antes de uma acao que nao tem volta.
  function handleDeleteAccount() {
    if (excluindo) return;
    confirmDestructive({
      title: 'Excluir sua conta?',
      message: 'Isso apaga sua sequência, conquistas, respostas e progresso de leitura para sempre. Não dá pra desfazer.',
      confirmLabel: 'Excluir conta',
      onConfirm: async () => {
        setExcluindo(true);
        try {
          await deleteAccount();
          await supabase.auth.signOut();
          clear();
        } catch {
          toast.show({ message: 'Não deu pra excluir sua conta.', detail: 'Tenta de novo daqui a pouco.', tone: 'danger' });
        } finally {
          setExcluindo(false);
        }
      },
    });
  }

  if (profileStatus === 'error') return <ProfileErrorState />;

  if (!profile || loading) {
    return (
      <Screen title="Você" contentStyle={styles.content}>
        <View style={styles.carregandoTopo}>
          <Skeleton width={84} height={84} borderRadius={radius.pill} />
          <Skeleton width="50%" height={28} />
        </View>
        <Skeleton width="100%" height={72} borderRadius={radius.control} />
        <Skeleton width="100%" height={120} borderRadius={radius.card} />
      </Screen>
    );
  }

  const streakEfetiva = effectiveStreak(streak ?? SEM_STREAK);
  const totalPages = sessions.reduce((soma, s) => soma + s.pages_read, 0);
  const media = overallAverage(answers);
  const semanas = constancyWeeks(sessions);
  const conquistas = decorateBadges(
    allBadges,
    badges,
    badgeStatsFrom({
      sessionCount: sessions.length,
      streak: streakEfetiva,
      answerCount: answers.length,
      booksFinished,
      totalPages,
    }),
  );
  const ganhas = conquistas.filter((b) => b.earned).length;
  const plano = entitlement ? planSummary(entitlement) : null;

  return (
    <Screen title="Você" refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
      {error ? <Banner tone="danger" message="Não deu pra atualizar seus dados. Puxe pra tentar de novo." onRetry={onRefresh} /> : null}

      <ProfileHeader name={profile.display_name} level={level} xp={xp} />

      <StatsRow
        items={[
          { value: String(streakEfetiva), label: streakEfetiva === 1 ? 'dia seguido' : 'dias seguidos' },
          { value: formatXp(totalPages), label: 'páginas' },
          { value: media === null ? 'sem nota' : String(media), label: 'média geral' },
        ]}
      />

      <View style={styles.secao}>
        <Text variant="subhead">Constância</Text>
        <ConstancyMap weeks={semanas} />
      </View>

      <View style={styles.secao}>
        <View style={styles.secaoTopo}>
          <Text variant="subhead">Conquistas</Text>
          <Text variant="caption" tone="tertiary">{`${ganhas} de ${conquistas.length}`}</Text>
        </View>
        {conquistas.length === 0 ? (
          <Text variant="callout" tone="tertiary">As conquistas aparecem aqui assim que chegarem.</Text>
        ) : (
          <BadgeList badges={conquistas} onPressBadge={setBadgeAberta} />
        )}
      </View>

      {plano ? (
        <View style={styles.secao}>
          <Text variant="subhead">Plano</Text>
          <ListRow
            title={plano.title}
            subtitle={plano.lines.join(' · ')}
            trailing={<ChevronRight size={20} color={color.text3} />}
            onPress={() => router.push('/planos')}
            accessibilityLabel={`${plano.title}. ${plano.lines.join('. ')}. Ver planos.`}
            last
          />
        </View>
      ) : null}

      <View style={styles.secao}>
        <Text variant="subhead">Conta</Text>
        {!profile.classroom_id ? (
          <ListRow
            title="Entrar em uma turma"
            subtitle="Com o código do seu professor"
            trailing={<ChevronRight size={20} color={color.text3} />}
            onPress={() => setTurmaAberta(true)}
          />
        ) : null}
        <ListRow title="Sair" tone="destructive" onPress={handleLogout} />
        <ListRow title="Excluir conta" tone="destructive" loading={excluindo} onPress={handleDeleteAccount} last />
      </View>

      <BadgeSheet badge={badgeAberta} onDismiss={() => setBadgeAberta(null)} />
      <ClassroomSheet
        visible={turmaAberta}
        onDismiss={() => setTurmaAberta(false)}
        onSuccess={() => {
          setTurmaAberta(false);
          toast.show({ message: 'Você entrou na turma.', tone: 'positive' });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, gap: space.xxl },
  carregandoTopo: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  secao: { gap: space.md },
  secaoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
