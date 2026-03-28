import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getStudentByUserId } from '../src/api/queries';

export default function RootLayout() {
  const {
    session,
    student,
    isInitialized,
    setSession,
    setStudent,
    setInitialized,
    clear,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let cancelled = false;

    // Hidrata sessão persistida e student na abertura do app
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
      if (session) {
        try {
          const s = await getStudentByUserId(session.user.id);
          if (!cancelled) setStudent(s);
        } catch (err) {
          console.error('Falha ao carregar perfil do aluno:', err);
        }
      }
      if (!cancelled) setInitialized();
    });

    // Reage a login/logout em tempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setSession(session);
      if (session) {
        try {
          const s = await getStudentByUserId(session.user.id);
          if (!cancelled) setStudent(s);
        } catch (err) {
          console.error('Falha ao carregar perfil do aluno:', err);
        }
      } else {
        clear();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setSession, setStudent, setInitialized, clear]);

  useEffect(() => {
    // Aguarda resolução da sessão inicial antes de redirecionar
    if (!isInitialized) return;

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !student && !inOnboarding) {
      router.replace('/(onboarding)/classroom-code');
    } else if (session && student && (inAuth || inOnboarding)) {
      router.replace('/(tabs)/');
    }
  }, [session, student, segments, isInitialized]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
