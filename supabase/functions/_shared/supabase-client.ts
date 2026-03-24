// supabase/functions/_shared/supabase-client.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
