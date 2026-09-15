// Checkout (BER-61, F6 Tarefa 5): confirmacao da assinatura no formato da
// folha de compra da loja. Com compra in-app quem coleta o pagamento e a App
// Store ou o Google Play, entao o app nunca tem campo de cartao. Por ora
// `billing` e a cobranca simulada (BER-79). Premium sem coroa nem dourado
// (DESIGN.md secao 10); erro em toast, no lugar do Alert.
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../src/stores/authStore';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { billing } from '../src/api/billing';
import { formatPrice } from '../src/utils/billing';
import { Button, Card, EmptyState, Glyph, Screen, Text, useToast } from '../src/ui';
import { color, space } from '../src/theme/tokens';

/** A confirmacao nao "pisca": da o mesmo ritmo de uma compra na loja. */
const MIN_PROCESSING_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Step = 'confirm' | 'processing' | 'success';

export default function CheckoutScreen() {
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuthStore();
  const { entitlement, setEntitlement } = useEntitlementStore();
  const [step, setStep] = useState<Step>('confirm');

  const plan = entitlement?.premium_plan;

  if (!plan) {
    return (
      <Screen title="Confirmar assinatura" onBack={() => router.back()} edges={['top', 'bottom']} contentStyle={styles.centro}>
        <EmptyState
          illustration="none"
          title="Plano indisponível no momento."
          description="Volte aos planos e tente de novo daqui a pouco."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const price = formatPrice(plan.price_cents);

  async function handleConfirm() {
    if (step !== 'confirm' || !plan) return;
    setStep('processing');
    try {
      const [updated] = await Promise.all([billing.purchase(plan.id), wait(MIN_PROCESSING_MS)]);
      setEntitlement(updated);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setStep('success');
    } catch {
      toast.show({ message: 'Não deu pra concluir a assinatura.', detail: 'Nada foi cobrado. Tenta de novo daqui a pouco.', tone: 'danger' });
      setStep('confirm');
    }
  }

  if (step === 'success') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']} contentStyle={styles.centro}>
        <EmptyState
          illustration={<Glyph size={40} />}
          title={`Bem-vindo ao ${plan.name}.`}
          description="Agora você lê quantos livros quiser e responde todos os quizzes, com feedback da IA em cada resposta."
          actionLabel="Continuar"
          // Fecha a confirmacao e os planos: volta pra onde o leitor estava.
          onAction={() => router.dismiss(2)}
        />
      </Screen>
    );
  }

  const processing = step === 'processing';

  return (
    <Screen
      title="Confirmar assinatura"
      onBack={processing ? undefined : () => router.back()}
      edges={['top', 'bottom']}
      contentStyle={styles.content}
    >
      <Card>
        <View style={styles.resumo}>
          <View>
            <Text variant="subhead">{`BeReading ${plan.name}`}</Text>
            <Text variant="caption" tone="tertiary">Assinatura mensal</Text>
          </View>
          <View style={styles.divisoria} />
          <SummaryRow label="Valor" value={`${price}/mês`} />
          <SummaryRow label="Renovação" value="Automática, todo mês" />
          <SummaryRow label="Conta" value={session?.user.email ?? 'sem e-mail'} />
          <SummaryRow label="Pagamento" value={Platform.OS === 'ios' ? 'Conta da App Store' : 'Conta do Google Play'} />
        </View>
      </Card>

      <Text variant="callout" tone="tertiary" align="center">
        {`Hoje você paga ${price}. A assinatura renova sozinha a cada mês e dá pra cancelar quando quiser, em Você, na linha do plano.`}
      </Text>

      <Button onPress={handleConfirm} loading={processing}>{`Assinar por ${price}/mês`}</Button>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.linha}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout" numberOfLines={1} style={styles.valor}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
  resumo: { gap: space.md },
  divisoria: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  valor: { flexShrink: 1, textAlign: 'right' },
});
