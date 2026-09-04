import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { loadOrCreateProfile } from '../src/api/profile';
import { useLuminousFonts } from '../src/theme/fonts';

export default function RootLayout() {
  const fontsLoaded = useLuminousFonts();
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

  if (!fontsLoaded) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
