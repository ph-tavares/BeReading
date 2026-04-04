import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getProfileByUserId, createProfile } from '../src/api/queries';

export default function RootLayout() {
  const {
    session,
    profile,
    isInitialized,
    setSession,
    setProfile,
    setInitialized,
    clear,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let cancelled = false;

    async function hydrateProfile(sess: NonNullable<typeof session>) {
      if (!sess.user.email_confirmed_at) return;
      try {
        let p = await getProfileByUserId(sess.user.id);
        if (!p) {
          p = await createProfile(
            sess.user.id,
            sess.user.user_metadata?.display_name ?? 'Leitor',
          );
        }
        if (!cancelled) setProfile(p);
      } catch (err) {
        console.error('Falha ao carregar perfil:', err);
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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setSession(session);
      if (session) {
        await hydrateProfile(session);
      } else {
        clear();
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

  return <Stack screenOptions={{ headerShown: false }} />;
}
