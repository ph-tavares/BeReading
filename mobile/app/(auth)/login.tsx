// Login (spec 7.10, F6 Tarefa 4). Estante de lombadas, marcador e wordmark no
// topo; erro inline no campo, no lugar do Alert. O botao continua desabilitado
// ate ter e-mail e senha (regra de antes).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { Button, Field, Screen } from '../../src/ui';
import { AuthHero, loginErrorMessage } from '../../src/features/auth';
import { space } from '../../src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const preenchido = email.trim() !== '' && password !== '';

  async function handleLogin() {
    if (!preenchido || loading) return;
    setErro(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setErro(loginErrorMessage(error.message));
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <AuthHero />

        <View>
          <Field
            label="E-mail"
            icon={Mail}
            value={email}
            onChangeText={(t) => { setEmail(t); setErro(null); }}
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <Field
            label="Senha"
            icon={Lock}
            value={password}
            onChangeText={(t) => { setPassword(t); setErro(null); }}
            placeholder="Sua senha"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            error={erro ?? undefined}
          />
        </View>

        <View style={styles.acoes}>
          <Button onPress={handleLogin} loading={loading} disabled={!preenchido}>Entrar</Button>
          <Button variant="ghost" onPress={() => router.push('/(auth)/signup')}>Criar conta</Button>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.xxl, paddingBottom: space.xl },
  acoes: { gap: space.sm },
});
