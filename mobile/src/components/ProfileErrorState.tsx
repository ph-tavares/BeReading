// src/components/ProfileErrorState.tsx
// BER-45: quando o perfil falha ao carregar (rede instável no cold start), as
// abas ficavam girando o spinner para sempre, sem mensagem, sem botão e sem
// saída a não ser fechar e reabrir o app. Esta é a saída.
//
// F9: mesma lógica, no sistema novo (Screen + EmptyState). Continua neste
// caminho porque Hoje, Explorar e Você já importam daqui.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { loadOrCreateProfile } from '../api/profile';
import { EmptyState, Screen } from '../ui';

export function ProfileErrorState() {
  const { session, setProfile, setProfileStatus } = useAuthStore();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (!session || retrying) return;
    setRetrying(true);
    setProfileStatus('loading');
    try {
      const profile = await loadOrCreateProfile(session);
      if (profile) {
        setProfile(profile);
      } else {
        setProfileStatus('error');
      }
    } catch {
      setProfileStatus('error');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Screen scroll={false} contentStyle={styles.centro}>
      <EmptyState
        illustration="none"
        title="Não conseguimos carregar seu perfil"
        description="Parece problema de conexão. Nada do que você registrou se perdeu."
        actionLabel={retrying ? 'Tentando…' : 'Tentar de novo'}
        onAction={retry}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centro: { justifyContent: 'center' },
});
