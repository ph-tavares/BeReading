// src/api/profile.ts
// Carregamento do perfil, fora do `_layout` para que a tela consiga tentar de
// novo (BER-45). Antes, isto vivia dentro do `useEffect` do layout raiz: quando
// falhava, o `console.error` era tudo o que acontecia, `profile` ficava null e
// não havia como repetir a chamada sem reabrir o app.
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import { createProfile, getProfileByUserId } from './queries';

/**
 * Busca o perfil da sessão; cria se ainda não existir.
 *
 * @returns `null` quando a sessão não está com e-mail confirmado — não é erro,
 *          é o usuário que ainda não terminou o cadastro.
 * @throws o erro de rede/banco, para quem chamou decidir o que mostrar.
 */
export async function loadOrCreateProfile(session: Session): Promise<Profile | null> {
  if (!session.user.email_confirmed_at) return null;

  const existing = await getProfileByUserId(session.user.id);
  if (existing) return existing;

  return await createProfile(
    session.user.id,
    session.user.user_metadata?.display_name ?? 'Leitor',
  );
}
