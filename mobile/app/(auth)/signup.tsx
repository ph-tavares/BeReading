// Criar conta (spec 7.10, F6 Tarefa 4). "Bora começar.", indicador de quanto
// falta pra senha de 6 e o botao desabilitado ate valer (regra de antes).
// E-mail ja cadastrado e erro do servidor aparecem na tela, sem Alert.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { usePendingAuthStore } from '../../src/stores/pendingAuthStore';
import { Banner, Button, Field, Glyph, Screen, Text } from '../../src/ui';
import { canSignup, isEmailAlreadyRegistered, passwordHint } from '../../src/features/auth';
import { space } from '../../src/theme/tokens';

export default function SignupScreen() {
  const router = useRouter();
  const setPendingPassword = usePendingAuthStore((s) => s.setPendingPassword);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailExistente, setEmailExistente] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const valido = canSignup(name, email, password);

  async function handleSignup() {
    if (!valido || loading) return;
    setEmailExistente(false);
    setErroGeral(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);

    if (error) {
      setErroGeral('Não deu pra criar sua conta agora. Tenta de novo.');
    } else if (isEmailAlreadyRegistered(data)) {
      setEmailExistente(true);
    } else {
      setPendingPassword(password);
      router.push({ pathname: '/(auth)/confirm-email', params: { email: email.trim() } });
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen onBack={() => router.back()} edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.topo}>
          <Glyph size={28} />
          <Text variant="display">Bora começar.</Text>
          <Text variant="body" tone="secondary">Em menos de um minuto você está lendo.</Text>
        </View>

        <View>
          <Field
            label="Nome"
            icon={User}
            value={name}
            onChangeText={setName}
            placeholder="Como a gente te chama?"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />
          <Field
            label="E-mail"
            icon={Mail}
            value={email}
            onChangeText={(t) => { setEmail(t); setEmailExistente(false); }}
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            error={emailExistente ? 'Esse e-mail já tem conta. Entre com ele.' : undefined}
          />
          <Field
            label="Senha"
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
            hint={passwordHint(password.length)}
          />
        </View>

        {erroGeral ? <Banner tone="danger" message={erroGeral} /> : null}

        <View style={styles.acoes}>
          <Text variant="caption" tone="tertiary" align="center">
            Ao continuar, você aceita os termos de uso e a política de privacidade.
          </Text>
          <Button onPress={handleSignup} loading={loading} disabled={!valido}>Criar conta</Button>
          {emailExistente ? (
            <Button variant="ghost" onPress={() => router.replace('/(auth)/login')}>Ir pro login</Button>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.xl, paddingBottom: space.xl },
  topo: { gap: space.sm },
  acoes: { gap: space.sm },
});
