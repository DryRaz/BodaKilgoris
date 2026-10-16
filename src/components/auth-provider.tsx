'use client';

import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isLocale } from '@/i18n/config';
import { useLocaleContext } from '@/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';
import type { BodaProfile, Profile, Role } from '@/lib/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  boda: BodaProfile | null;
  loading: boolean;
}

interface AuthApi extends AuthState {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const homeFor = (role: Role) => (role === 'admin' ? '/admin' : role === 'boda' ? '/boda' : '/client');
export const loginFor = (role: Role) =>
  role === 'admin' ? '/admin/login' : role === 'boda' ? '/boda/login' : '/client/start';

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { setLocale, locale } = useLocaleContext();
  const [state, setState] = useState<AuthState>({ user: null, profile: null, boda: null, loading: true });
  const loadedFor = useRef<string | null>(null);
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  const load = useCallback(
    async (user: User | null, opts?: { syncLanguage?: boolean }) => {
      if (!user) {
        loadedFor.current = null;
        setState({ user: null, profile: null, boda: null, loading: false });
        return;
      }
      const supabase = getSupabase();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      let boda: BodaProfile | null = null;
      if (profile?.role === 'boda') {
        const res = await supabase.from('boda_profiles').select('*').eq('user_id', user.id).maybeSingle();
        boda = res.data as BodaProfile | null;
      }
      loadedFor.current = user.id;
      setState({ user, profile: profile as Profile | null, boda, loading: false });
      // the language stored on the account wins when someone signs in on a new phone
      if (opts?.syncLanguage && profile && isLocale(profile.language) && profile.language !== localeRef.current) {
        setLocale(profile.language);
      }
    },
    [setLocale],
  );

  useEffect(() => {
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // never call supabase from inside this callback directly (can deadlock) -> defer
      setTimeout(() => {
        if (event === 'TOKEN_REFRESHED' && session?.user.id === loadedFor.current) return;
        const isNewUser = session?.user.id !== loadedFor.current;
        void load(session?.user ?? null, { syncLanguage: isNewUser });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    // local read of the stored session (no network round-trip)
    const { data } = await getSupabase().auth.getSession();
    await load(data.session?.user ?? null);
  }, [load]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await getSupabase().auth.signOut({ scope: 'local' }).catch(() => {});
    setState({ user: null, profile: null, boda: null, loading: false });
    loadedFor.current = null;
    router.replace('/');
  }, [router]);

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Redirects away when the visitor is signed out or has the wrong role. */
export function useRequireRole(role: Role) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.profile) router.replace(loginFor(role));
    else if (auth.profile.role !== role) router.replace(homeFor(auth.profile.role));
  }, [auth.loading, auth.profile, role, router]);
  return { ...auth, ready: !auth.loading && auth.profile?.role === role };
}
