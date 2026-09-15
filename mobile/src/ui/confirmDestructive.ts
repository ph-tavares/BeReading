import { Alert } from 'react-native';

interface Opcoes {
  title: string;
  message: string;
  confirmLabel: string;
  /** Padrao: "Cancelar". Planos usa "Manter Premium". */
  cancelLabel?: string;
  onConfirm: () => void;
}

// Confirmacao de acao que nao se desfaz (sair, excluir conta, tirar da leitura,
// cancelar assinatura). Usa o dialogo do sistema, e nao um modal proprio: a spec
// (secao 8) tira o Alert.alert de tudo, menos daqui, porque acao irreversivel
// merece o padrao que o sistema operacional ja ensina a respeitar. E o unico
// arquivo de src/ui com Alert.alert, e por isso esta na excecao permanente da
// guarda de feedback.
export function confirmDestructive({
  title, message, confirmLabel, cancelLabel = 'Cancelar', onConfirm,
}: Opcoes): void {
  Alert.alert(
    title,
    message,
    [
      { text: cancelLabel, style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ],
    { cancelable: true },
  );
}
