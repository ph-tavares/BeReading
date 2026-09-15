// Confirmar e-mail (spec 7.10, F6 Tarefa 4). Toda a logica da BER-43 continua
// identica; o que muda e a apresentacao: ping ambar mais lento, avisos inline
// no lugar dos Alerts e contador de 60 s no "Reenviar".
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { usePendingAuthStore } from '../../src/stores/pendingAuthStore';
import { Banner, Button, Screen, Text, useToast } from '../../src/ui';
import { EmailPing, RESEND_COOLDOWN_S, resendLabel } from '../../src/features/auth';
import { space } from '../../src/theme/tokens';
import {
  classifyRefreshResult,
  classifySignInError,
  shouldClearPendingPassword,
} from '../../src/utils/confirmEmail';

type Aviso = { tone: 'danger' | 'info'; message: string; paraLogin?: boolean };

const AINDA_NAO = 'Seu e-mail ainda não foi confirmado. Abra o link e tente de novo.';

export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { pendingPassword, clearPendingPassword } = usePendingAuthStore();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // O e-mail acabou de sair no cadastro: o primeiro reenvio ja espera o contador.
  const [restante, setRestante] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (restante <= 0) return;
    const timer = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [restante]);

  async function handleAlreadyConfirmed() {
    if (checking) return;
    setAviso(null);
    setChecking(true);

    if (email && pendingPassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pendingPassword });
      setChecking(false);

      // BER-43: a senha guardada so e descartada DEPOIS de entrar. Antes ela era
      // apagada aqui em cima, e o segundo toque em "Ja confirmei" caia no branch
      // sem senha, que mandava o usuario para o login para redigitar tudo.
      const outcome = classifySignInError(error);
      if (shouldClearPendingPassword(outcome)) {
        clearPendingPassword();
        return;
      }

      if (outcome === 'not-confirmed') {
        setAviso({ tone: 'info', message: AINDA_NAO });
        return;
      }
      setAviso({ tone: 'danger', message: 'Não deu pra entrar agora. Tenta de novo.' });
      return;
    }

    const result = await supabase.auth.refreshSession();
    setChecking(false);

    switch (classifyRefreshResult(result)) {
      case 'confirmed':
        return;
      case 'session_revoked':
        // BER-43: antes ia direto para o login, sem dizer por que. Quem confirmou
        // pelo navegador perde a sessao do app. O destino esta certo, o silencio
        // e que nao estava.
        setAviso({
          tone: 'info',
          message: 'Seu e-mail foi confirmado em outro lugar e esta sessão expirou. É só entrar com o e-mail e a senha que você acabou de cadastrar.',
          paraLogin: true,
        });
        return;
      default:
        setAviso({ tone: 'info', message: AINDA_NAO });
    }
  }

  async function handleResend() {
    if (resending || restante > 0) return;
    if (!email) {
      setAviso({ tone: 'info', message: 'Volte ao cadastro e tente de novo.' });
      return;
    }
    setAviso(null);
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      setAviso({ tone: 'danger', message: 'Não deu pra reenviar o e-mail. Tenta de novo.' });
    } else {
      setRestante(RESEND_COOLDOWN_S);
      toast.show({ message: 'E-mail reenviado.', detail: 'Confere a caixa de entrada e o spam.', tone: 'positive' });
    }
  }

  return (
    <Screen onBack={() => router.back()} edges={['top', 'bottom']} contentStyle={styles.content}>
      <EmailPing />

      <View style={styles.textos}>
        <Text variant="title" align="center">Confirme seu e-mail</Text>
        <Text variant="body" tone="secondary" align="center">
          Enviamos um link pro seu e-mail. Abra e toque nele pra ativar sua conta.
        </Text>
        {email ? <Text variant="subhead" align="center">{email}</Text> : null}
        <Text variant="callout" tone="tertiary" align="center">
          Não chegou em alguns minutos? Olha no spam ou em promoções.
        </Text>
      </View>

      {aviso ? <Banner tone={aviso.tone} message={aviso.message} /> : null}

      <View style={styles.acoes}>
        {aviso?.paraLogin ? (
          <Button onPress={() => router.replace('/(auth)/login')}>Ir para o login</Button>
        ) : (
          <Button onPress={handleAlreadyConfirmed} loading={checking}>Já confirmei</Button>
        )}
        <Button variant="ghost" onPress={handleResend} loading={resending} disabled={restante > 0}>
          {resendLabel(restante)}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl, paddingTop: space.xl, paddingBottom: space.xl },
  textos: { gap: space.sm },
  acoes: { gap: space.sm },
});
