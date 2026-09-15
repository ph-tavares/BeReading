import '../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { loadOrCreateProfile } from '../src/api/profile';
import { useAppFonts } from '../src/theme/fonts';
import { color } from '../src/theme/tokens';
import { ToastProvider } from '../src/ui/Toast';

// Rota aberta direto (link bereading://, Expo Go restaurando a última tela)
// virava a primeira da pilha: o sheet de registro sem nada atrás e sem saída
// (R2, 15/09). O anchor põe as abas embaixo de qualquer rota aberta assim, então
// a Hoje sempre está na pilha.
export const unstable_settings = { anchor: '(tabs)' };

// A splash fica até fonte e sessão estarem prontas. Sem isso, o app pisca uma
// tela vazia entre a splash e a primeira rota — num app escuro, isso aparece.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const {
    session,
    profile,
    isInitialized,
    setSession,
    setProfile,
    setProfileStatus,
    setInitialized,
    clear,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let cancelled = false;

    async function hydrateProfile(sess: NonNullable<typeof session>) {
      if (!sess.user.email_confirmed_at) return;
      if (!cancelled) setProfileStatus('loading');
      try {
        const p = await loadOrCreateProfile(sess);
        if (!cancelled && p) setProfile(p);
      } catch (err) {
        // BER-45: antes parava aqui, no console. As abas ficavam girando para
        // sempre porque esperavam um `profile` que nunca ia chegar.
        console.error('Falha ao carregar perfil:', err);
        if (!cancelled) setProfileStatus('error');
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
      if (session) await hydrateProfile(session);
      if (!cancelled) setInitialized();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSession(session);
      if (session) {
        // O supabase-js roda este callback dentro de uma trava exclusiva, e o
        // perfil é outra chamada ao Supabase, que espera a mesma trava. Com
        // await aqui dentro, a renovação de token na abertura travava o app com
        // a splash na tela (R2, 15/09). O setTimeout tira o carregamento de
        // dentro da trava, como a doc do auth-js recomenda.
        setTimeout(() => {
          if (!cancelled) void hydrateProfile(session);
        }, 0);
      } else {
        clear();
        // BER-61: o plano do leitor anterior não pode vazar para o próximo login.
        useEntitlementStore.getState().clear();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setSession, setProfile, setInitialized, clear]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuth = segments[0] === '(auth)';
    const emailConfirmed = !!session?.user.email_confirmed_at;

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !emailConfirmed && !inAuth) {
      router.replace('/(auth)/confirm-email');
    } else if (session && emailConfirmed && profile && inAuth) {
      router.replace('/');
    }
    // session + confirmed + !profile: createProfile em andamento, aguarda
  }, [session, profile, segments, isInitialized, router]);

  useEffect(() => {
    if (fontsLoaded && isInitialized) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isInitialized]);

  if (!fontsLoaded) return null;

  return (
    // Sem initialMetrics, o SafeAreaProvider da v5 renderiza null ate a
    // primeira medicao nativa chegar — a View de fundo abaixo fica dentro
    // dele, entao o primeiro quadro sai em branco: exatamente o flash que a
    // splash (acima) existe para esconder. initialWindowMetrics preenche a
    // medida sincronamente, do modulo nativo, antes do primeiro render.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
            {/* Sheet de registrar leitura (spec S6/S7.2): meia tela por padrão,
                arrastável até tela cheia, com grabber visível. */}
            <Stack.Screen
              name="register-reading"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.7, 1],
                sheetGrabberVisible: true,
              }}
            />
            {/* Quiz e resumo viram modal de tela cheia: é uma conversa, não faz
                sentido a tab bar aparecer atrás. */}
            <Stack.Screen name="quiz/[chapterId]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="quiz/summary" options={{ presentation: 'fullScreenModal' }} />
            {/* Rota nova da Tarefa 4 (placeholder nesta fase, conteúdo real na
                F4): mesma apresentação do quiz, por ser a tela de conquista que
                antecede ele. */}
            <Stack.Screen name="chapter-complete" options={{ presentation: 'fullScreenModal' }} />
          </Stack>
        </ToastProvider>
      </View>
    </SafeAreaProvider>
  );
}
