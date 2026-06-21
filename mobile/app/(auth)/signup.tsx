import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Compass, Lock, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { usePendingAuthStore } from '../../src/stores/pendingAuthStore';
import { BrandHeader } from '../../src/components/BrandHeader';
import { AuthField } from '../../src/components/AuthField';
import { Press3DButton } from '../../src/components/Press3DButton';
import { colors, fonts, radii } from '../../src/theme/tokens';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setPendingPassword = usePendingAuthStore((s) => s.setPendingPassword);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos para continuar');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Não foi possível criar conta', error.message);
    } else if (Array.isArray(data.user?.identities) && data.user!.identities.length === 0) {
      Alert.alert('Email já cadastrado', 'Este email já possui uma conta. Faça login para entrar.');
    } else {
      setPendingPassword(password);
      router.push({
        pathname: '/(auth)/confirm-email',
        params: { email: email.trim() },
      });
    }
  }

  const valid = name.trim().length >= 2 && email.includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 30,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          padding: 20,
          paddingTop: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: colors.bgRaise,
              borderWidth: 1,
              borderColor: colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={16} color={colors.text} strokeWidth={2.2} />
          </Pressable>
          <BrandHeader />
          <View style={{ width: 38 }} />
        </View>

        {/* Mascote centralizado */}
        <View style={{
          padding: 18,
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
        }}>
          <Image
            source={require('../../assets/images/mascot2.png')}
            style={{ height: 200, maxWidth: '100%' }}
            resizeMode="contain"
          />
        </View>

        <View style={{ padding: 24, paddingTop: 10 }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 24,
            color: colors.text,
            letterSpacing: -0.5,
            textAlign: 'center',
            marginBottom: 6,
          }}>Começa a sua saga</Text>
          <Text style={{
            fontFamily: fonts.semi,
            fontSize: 13.5,
            color: colors.textMute,
            textAlign: 'center',
            marginBottom: 22,
          }}>Em menos de 1 minuto você está lendo.</Text>

          <AuthField
            label="Nome"
            Icon={User}
            value={name}
            onChangeText={setName}
            placeholder="Como te chamamos?"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />
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
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 11,
            color: colors.textMute,
            textAlign: 'center',
            marginBottom: 14,
            lineHeight: 16,
          }}>
            Ao continuar, você aceita os termos de uso e a política de privacidade.
          </Text>

          <Press3DButton
            onPress={handleSignup}
            disabled={loading || !valid}
            Icon={ArrowRight}
            size="lg"
            color="purple"
          >
            {loading ? 'Criando conta…' : 'Criar conta'}
          </Press3DButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
