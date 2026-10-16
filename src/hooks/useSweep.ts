'use client';

import { useEffect } from 'react';
import { SWEEP_MS } from '@/lib/constants';
import { syncServerTime } from '@/lib/clock';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Calls sweep_rides() on mount and every 30 s: expires unanswered requests, auto-confirms rides
 * after 30 min, switches silent Bodas off — and returns the server time so we can fix clock skew.
 * (pg_cron can do the same job server-side: see supabase/optional_cron.sql.)
 */
export function useSweep(enabled: boolean, onSwept?: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const run = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      const started = Date.now();
      const { data, error } = await getSupabase().rpc('sweep_rides');
      if (!error && typeof data === 'string') {
        syncServerTime(data, started, Date.now());
        onSwept?.();
      }
    };
    void run();
    const id = setInterval(run, SWEEP_MS);
    const onVisible = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, onSwept]);
}
