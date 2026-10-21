'use client';

import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/components/toast';
import { logSupabaseError } from '@/lib/alerts';
import { getSupabase } from '@/lib/supabase/client';

interface AlertCountApi { count: number; refresh: () => Promise<void> }
const AlertCountContext = createContext<AlertCountApi>({ count: 0, refresh: async () => {} });
export const useAlertCount = () => useContext(AlertCountContext);

const POLL_MS = 10_000;

/**
 * Number of NEW alerts, for the admin badge. It polls a small admin-only RPC (no Realtime on purpose: a
 * Realtime channel on the alerts table would also tell a curious client that such a table exists, and
 * DELETE events are not filtered by RLS). Cheap: one integer every 10 s, only while the tab is visible.
 * A discreet toast appears when the number goes up.
 */
export function AlertCountProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const t = useTranslations('admin.alerts');
  const toast = useToast();
  const [count, setCount] = useState(0);
  const last = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await getSupabase().rpc('admin_alerts_count');
    if (error) return logSupabaseError('admin_alerts_count', error);
    const n = Number(data ?? 0);
    if (last.current !== null && n > last.current) toast.show(t('toastNew', { count: n - last.current }), 'info');
    last.current = n;
    setCount(n);
  }, [t, toast]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const tick = () => document.visibilityState === 'visible' && void refresh();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, refresh]);

  const api = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <AlertCountContext.Provider value={api}>{children}</AlertCountContext.Provider>;
}
