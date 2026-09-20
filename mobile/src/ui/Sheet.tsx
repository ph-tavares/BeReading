import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, elevation, radius, space } from '../theme/tokens';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** O que o leitor de tela anuncia ao abrir (normalmente o titulo). */
  accessibilityLabel: string;
  children: React.ReactNode;
}

// Folha inferior do sistema (paywall, e na F6 o que hoje e modal legado). Sem
// grabber: esta folha nao arrasta, e um puxador que nao puxa e affordance falsa.
// Fecha por toque fora, pelo voltar do Android e pela acao de quem usa.
//
// Excecao deliberada a regra "so o Screen le insets": o Modal abre fora da
// arvore da tela, entao a folha precisa do inset inferior por conta propria.
export function Sheet({ visible, onDismiss, accessibilityLabel, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        {/* Sem accessibilityViewIsModal: o Modal ja abre em janela nativa propria,
            entao a tela de tras nunca fica acessivel, e a marca so escondia do
            leitor de tela o scrim ao lado, que e o "Fechar" de quem nao ve. */}
        <View
          accessibilityLabel={accessibilityLabel}
          style={[styles.panel, { paddingBottom: insets.bottom + space.xl }]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim },
  panel: {
    ...elevation.floating,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
    gap: space.md,
  },
});
