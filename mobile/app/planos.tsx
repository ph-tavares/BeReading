// Planos (BER-61, F6 Tarefa 5): comparacao dos planos e gestao da assinatura
// (assinar, cancelar, retomar). A logica e a do time; a apresentacao segue o
// DESIGN.md secao 10: Premium sem cor propria, sem coroa, e o ambar so na
// acao primaria. Cancelar confirma com o dialogo do sistema.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { billing } from '../src/api/billing';
import { formatDateBR, formatPrice, planFeatures, type Entitlement } from '../src/utils/billing';
import { Button, EmptyState, Screen, Skeleton, Text, confirmDestructive, useToast } from '../src/ui';
import { PlanOption } from '../src/features/plans/PlanOption';
import { radius, space } from '../src/theme/tokens';

export default function PlanosScreen() {
  const router = useRouter();
  const toast = useToast();
  const { entitlement, refresh, setEntitlement } = useEntitlementStore();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  if (!entitlement) {
    return (
      <Screen title="Planos" onBack={() => router.back()} edges={['top', 'bottom']} contentStyle={styles.content}>
        {loading ? (
          <>
            <Skeleton width="100%" height={220} borderRadius={radius.card} />
            <Skeleton width="100%" height={180} borderRadius={radius.card} />
          </>
        ) : (
          <EmptyState
            illustration="none"
            title="Não deu pra carregar os planos."
            description="Confere a conexão e tenta de novo."
            actionLabel="Tentar de novo"
            onAction={() => {
              setLoading(true);
              refresh().finally(() => setLoading(false));
            }}
          />
        )}
      </Screen>
    );
  }

  const premium = entitlement.plan === 'premium';
  const subscription = entitlement.subscription;
  const price = formatPrice(entitlement.premium_plan.price_cents);
  const periodEnd = subscription ? formatDateBR(subscription.current_period_end) : null;
  const features = planFeatures(entitlement);

  async function run(action: () => Promise<Entitlement>) {
    if (working) return;
    setWorking(true);
    try {
      setEntitlement(await action());
    } catch {
      toast.show({ message: 'Não deu pra concluir.', detail: 'Tenta de novo daqui a pouco.', tone: 'danger' });
    } finally {
      setWorking(false);
    }
  }

  function handleCancel() {
    confirmDestructive({
      title: 'Cancelar assinatura?',
      message: `Você continua com o Premium até ${periodEnd}. Depois disso, sua conta volta pro plano gratuito, e nada do seu progresso é apagado.`,
      confirmLabel: 'Cancelar assinatura',
      cancelLabel: 'Manter Premium',
      onConfirm: () => { void run(() => billing.cancel()); },
    });
  }

  return (
    <Screen title="Planos" onBack={() => router.back()} edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={styles.intro}>
        <Text variant="heading">{premium ? 'Você é Premium' : 'Leia sem limites'}</Text>
        <Text variant="body" tone="secondary">
          {premium
            ? 'Obrigado por ler com o BeReading. Seus livros e quizzes não têm limite.'
            : 'Acompanhe quantos livros quiser e receba perguntas e feedback da IA em todos os capítulos.'}
        </Text>
      </View>

      <PlanOption
        name={entitlement.premium_plan.name}
        price={price}
        period="/mês"
        features={features.premium}
        current={premium}
        highlight={!premium}
      />
      <PlanOption name="Gratuito" price="R$ 0" features={features.free} current={!premium} />

      {!premium ? (
        <View style={styles.acoes}>
          <Button onPress={() => router.push('/checkout')}>{`Assinar por ${price}/mês`}</Button>
          <Text variant="caption" tone="tertiary" align="center">Renovação mensal automática. Cancele quando quiser.</Text>
        </View>
      ) : null}

      {premium && subscription && !subscription.cancel_at_period_end ? (
        <View style={styles.acoes}>
          <Text variant="callout" tone="secondary" align="center">{`Sua assinatura renova em ${periodEnd}.`}</Text>
          <Button variant="ghost" onPress={handleCancel} loading={working}>Cancelar assinatura</Button>
        </View>
      ) : null}

      {premium && subscription?.cancel_at_period_end ? (
        <View style={styles.acoes}>
          <Text variant="callout" tone="secondary" align="center">{`Seu Premium vale até ${periodEnd} e não vai renovar.`}</Text>
          <Button onPress={() => { void run(() => billing.resume()); }} loading={working}>Retomar assinatura</Button>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
  intro: { gap: space.sm },
  acoes: { gap: space.sm, marginTop: space.sm },
});
