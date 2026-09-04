// src/components/ProfileErrorState.tsx
// BER-45: quando o perfil falha ao carregar (rede instável no cold start), as
// abas ficavam girando o spinner para sempre — sem mensagem, sem botão, sem
// saída a não ser fechar e reabrir o app. Esta é a saída.
import { useState } from 'react';
import { View, Text } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { useAuthStore } from '../stores/authStore';
import { loadOrCreateProfile } from '../api/profile';
import { Press3DButton } from './Press3DButton';
import { colors, fonts } from '../theme/tokens';

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
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 20,
    }}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <WifiOff size={28} color={colors.textSoft} strokeWidth={2.2} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 20,
          color: colors.text,
          textAlign: 'center',
          letterSpacing: -0.3,
        }}>Não conseguimos carregar seu perfil</Text>
        <Text style={{
          fontFamily: fonts.medium,
          fontSize: 15,
          color: colors.textSoft,
          textAlign: 'center',
          lineHeight: 22,
        }}>
          Parece problema de conexão. Nada do que você registrou se perdeu.
        </Text>
      </View>

      <Press3DButton onPress={retry} disabled={retrying} Icon={RefreshCw}>
        {retrying ? 'Tentando…' : 'Tentar de novo'}
      </Press3DButton>
    </View>
  );
}
