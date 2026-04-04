import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleAlreadyConfirmed() {
    setChecking(true);
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);

    const confirmed = !error && !!data?.session?.user.email_confirmed_at;
    if (!confirmed) {
      Alert.alert('Email ainda não confirmado', 'Verifique sua caixa de entrada e tente novamente.');
      return;
    }
    // Se confirmado, onAuthStateChange no root layout detecta e navega automaticamente
  }

  async function handleResend() {
    if (!email) {
      Alert.alert('Reenviar email', 'Volte à tela de cadastro e tente novamente.');
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      Alert.alert('Erro ao reenviar', error.message);
    } else {
      Alert.alert('Email reenviado', 'Verifique sua caixa de entrada.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {/* Ícone decorativo */}
        <View style={styles.iconWrap}>
          <View style={styles.iconOuter}>
            <Text style={styles.iconText}>✉</Text>
          </View>
        </View>

        {/* Cabeçalho */}
        <Text style={styles.title}>Confirme seu email</Text>
        <View style={styles.accentLine} />
        <Text style={styles.subtitle}>
          Enviamos um link de confirmação para{'\n'}
          <Text style={styles.emailText}>{email ?? 'seu email'}</Text>
          {'\n'}Clique no link para ativar sua conta.
        </Text>

        {/* Ação principal */}
        <TouchableOpacity
          style={[styles.button, checking && styles.buttonDisabled]}
          onPress={handleAlreadyConfirmed}
          disabled={checking}
          activeOpacity={0.82}
        >
          <Text style={styles.buttonText}>
            {checking ? 'Verificando…' : 'Já confirmei meu email'}
          </Text>
        </TouchableOpacity>

        {/* Ação secundária */}
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={handleResend}
          disabled={resending}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryText}>
            {resending ? 'Reenviando…' : 'Reenviar email de confirmação'}
          </Text>
        </TouchableOpacity>

        {/* Voltar */}
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryText, styles.linkText]}>Voltar para o login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconWrap: {
    marginBottom: 32,
  },
  iconOuter: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  accentLine: {
    width: 40,
    height: 3,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  emailText: {
    fontWeight: '600',
    color: '#374151',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryAction: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    color: '#6B7280',
  },
  linkText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
});
