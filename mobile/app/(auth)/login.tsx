import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Lock, ArrowRight, Plus } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { BrandHeader } from '../../src/components/BrandHeader';
import { AuthField } from '../../src/components/AuthField';
import { Press3DButton } from '../../src/components/Press3DButton';
import { GhostButton } from '../../src/components/GhostButton';
import { colors, fonts } from '../../src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Campos obrigatórios', 'Preencha email e senha para continuar');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert('Não foi possível entrar', error.message);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 280,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ padding: 24, paddingTop: 24 }}>
          <BrandHeader />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 28,
            color: colors.text,
            letterSpacing: -0.5,
            textAlign: 'center',
            marginBottom: 6,
          }}>Bem-vindo de volta!</Text>
          <Text style={{
            fontFamily: fonts.semi,
            fontSize: 13.5,
            color: colors.textMute,
            textAlign: 'center',
            marginBottom: 26,
          }}>A saga continua de onde você parou.</Text>

          <AuthField
            label="E-mail"
            Icon={Compass}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
          <AuthField
            label="Senha"
            Icon={Lock}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <View style={{ marginTop: 8 }}>
            <Press3DButton
              onPress={handleLogin}
              disabled={loading || !email.trim() || !password}
              Icon={ArrowRight}
              size="lg"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </Press3DButton>
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginVertical: 20,
          }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
            <Text style={{
              fontFamily: fonts.bold,
              fontSize: 10.5,
              color: colors.textMute,
              letterSpacing: 1.2,
            }}>OU</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />
          </View>

          <GhostButton onPress={() => router.push('/(auth)/signup')} Icon={Plus}>
            Criar conta nova
          </GhostButton>
        </View>
      </ScrollView>

      {/* Mascote — bottom-left */}
      <View pointerEvents="none" style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 260,
        height: 260,
      }}>
        <Image
          source={require('../../assets/images/mascot1.png')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
