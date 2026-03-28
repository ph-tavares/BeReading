import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getStudentByUserId } from '../src/api/queries';

export default function RootLayout() {
  const { session, student, setSession, setStudent, clear } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const s = await getStudentByUserId(session.user.id);
        setStudent(s);
      } else {
        clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !student && !inOnboarding) {
      router.replace('/(onboarding)/classroom-code');
    } else if (session && student && (inAuth || inOnboarding)) {
      router.replace('/(tabs)/');
    }
  }, [session, student, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
