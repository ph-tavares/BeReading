import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Sheet, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { paywallCopy, type QuotaExceeded } from '../../utils/billing';

interface Props {
  /** Limite atingido; `null` fecha a folha. */
  quota: QuotaExceeded | null;
  onDismiss: () => void;
}

// BER-58: o leitor bateu num limite do plano gratuito. E convite, nao erro, e
// sempre da para dispensar. Premium nao tem cor propria (DESIGN.md secao 10):
// sem icone de realeza e sem dourado; a acao e o botao primario, que ja e o
// acento da tela. A copy e a do time (paywallCopy), sem reescrever a regra.
export function PaywallSheet({ quota, onDismiss }: Props) {
  const router = useRouter();
  const copy = quota ? paywallCopy(quota) : null;

  function conhecer() {
    onDismiss();
    router.push('/planos');
  }

  return (
    <Sheet visible={copy !== null} onDismiss={onDismiss} accessibilityLabel={copy?.title ?? 'Premium'}>
      {copy ? (
        <>
          <Text variant="heading">{copy.title}</Text>
          <Text variant="callout" tone="secondary">{copy.description}</Text>
          {copy.hint ? <Text variant="caption" tone="tertiary">{copy.hint}</Text> : null}
          <View style={styles.acoes}>
            <Button onPress={conhecer}>Conhecer o Premium</Button>
            <Button variant="ghost" onPress={onDismiss}>Agora não</Button>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  acoes: { marginTop: space.md, gap: space.sm },
});
