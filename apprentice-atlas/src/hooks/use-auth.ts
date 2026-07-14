import { useEffect, useState } from 'react';

import { getAuthClient, getSession, signOut, subscribeToAuth, type AuthError } from '@/lib/auth';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => undefined;
    void (async () => {
      const result = await getSession();
      if (!mounted) return;
      setSession(result.data); setError(result.error); setLoading(false);
      const client = await getAuthClient();
      if (mounted && !('code' in client)) {
        const subscription = subscribeToAuth((_event, nextSession) => { setSession(nextSession); setError(null); }, client);
        unsubscribe = subscription.unsubscribe;
      }
    })();
    return () => { mounted = false; unsubscribe(); };
  }, []);

  return { session, user: session?.user ?? null as User | null, loading, error, signOut: async () => { const result = await signOut(); setError(result.error); if (!result.error) setSession(null); return result; } };
}
