import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Info, CheckCircle, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { usePendingAuthStore } from '../../src/stores/pendingAuthStore';
import { Press3DButton } from '../../src/components/Press3DButton';
import { GhostButton } from '../../src/components/GhostButton';
import { colors, fonts, radii } from '../../src/theme/tokens';

export default function ConfirmEmailScreen() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const { pendingPassword, clearPendingPassword } = usePendingAuthStore();

  // Animação ping do envelope (2 camadas defasadas)
  const ping1 = useRef(new Animated.Value(0)).current;
  const ping2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 2000,
            easing: Easing.bezier(0, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a = make(ping1, 0);
    const b = make(ping2, 400);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [ping1, ping2]);

  async function handleAlreadyConfirmed() {
    setChecking(true);

    if (email && pendingPassword) {
      clearPendingPassword();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pendingPassword });
      setChecking(false);

      if (!error) return;

      if (error.message.toLowerCase().includes('email not confirmed')) {
        Alert.alert('Email ainda não confirmado', 'Verifique sua caixa de entrada e tente novamente.');
        return;
      }
      Alert.alert('Erro ao fazer login', error.message);
      return;
    }

    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);

    if (!error && data?.session?.user.email_confirmed_at) return;
    if (error || !data?.session) {
      router.replace('/(auth)/login');
      return;
    }
    Alert.alert('Email ainda não confirmado', 'Verifique sua caixa de entrada e tente novamente.');
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

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    inset: 0 as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: colors.sky,
    transform: [{
      scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }),
    }],
    opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.55, 0, 0] }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 30,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ paddingVertical: 20 }}>
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
        </View>

        <View style={{ flex: 1, alignItems: 'stretch', paddingTop: 20 }}>
          {/* Envelope with ping */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{ width: 130, height: 130 }}>
              <Animated.View style={ringStyle(ping1)} />
              <Animated.View style={ringStyle(ping2)} />
              <View style={{
                width: 130,
                height: 130,
                borderRadius: 36,
                backgroundColor: colors.sky,
                borderBottomWidth: 4,
                borderBottomColor: colors.skyDeep,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Mail size={58} color="#fff" strokeWidth={2} />
              </View>
            </View>
          </View>

          <Text style={{
            fontFamily: fonts.black,
            fontSize: 24,
            color: colors.text,
            letterSpacing: -0.5,
            textAlign: 'center',
            marginBottom: 10,
            lineHeight: 29,
          }}>Confirme seu e-mail</Text>

          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 14,
            color: colors.textSoft,
            lineHeight: 21,
            textAlign: 'center',
            marginBottom: 18,
          }}>
            Enviamos um link mágico pro seu e-mail.{'\n'}
            Abre e clica pra ativar sua conta.
          </Text>

          {email && (
            <Text style={{
              fontFamily: fonts.bold,
              fontSize: 13,
              color: colors.text,
              textAlign: 'center',
              marginBottom: 18,
            }}>{email}</Text>
          )}

          <View style={{
            backgroundColor: colors.bgRaise,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radii.md,
            padding: 14,
            marginBottom: 28,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <Info size={16} color={colors.sky} strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={{
              fontFamily: fonts.medium,
              fontSize: 12.5,
              color: colors.textMute,
              lineHeight: 18,
              flex: 1,
            }}>
              Não chegou em alguns minutos? Dá uma olhada na caixa de <Text style={{ color: colors.text, fontFamily: fonts.bold }}>spam</Text> ou promoções.
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <Press3DButton
              onPress={handleAlreadyConfirmed}
              disabled={checking}
              Icon={CheckCircle}
              size="lg"
              color="sky"
            >
              {checking ? 'Verificando…' : 'Já confirmei'}
            </Press3DButton>
            <GhostButton onPress={handleResend} Icon={RefreshCw}>
              {resending ? 'Reenviando…' : 'Reenviar e-mail'}
            </GhostButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
