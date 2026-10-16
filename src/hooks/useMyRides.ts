'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_MS } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase/client';
import type { Ride } from '@/lib/types';

const WINDOW_MS = 36 * 3600_000; // enough to cover "today" in Nairobi + unconfirmed rides

/**
 * The signed-in user's recent rides, kept fresh by Realtime (instant) plus a light poll
 * (safety net for flaky connections) and a refetch whenever the app comes back to the foreground.
 */
export function useMyRides(role: 'boda' | 'client', userId: string | undefined) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const aliveRef = useRef(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    const column = role === 'boda' ? 'boda_id' : 'client_id';
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data, error } = await getSupabase()
      .from('rides')
      .select('*')
      .eq(column, userId)
      .gte('requested_at', since)
      .order('requested_at', { ascending: false })
      .limit(100);
    if (!error && aliveRef.current) {
      setRides((data ?? []) as Ride[]);
      setLoaded(true);
    }
  }, [role, userId]);

  useEffect(() => {
    aliveRef.current = true;
    if (!userId) return;
    const supabase = getSupabase();
    const column = role === 'boda' ? 'boda_id' : 'client_id';
    void reload();

    const channel = supabase
      .channel(`my-rides-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `${column}=eq.${userId}` },
        (payload) => {
          const row = payload.new as Ride | Record<string, never>;
          if (!('id' in row) || !row.id) return;
          setRides((prev) => {
            const without = prev.filter((r) => r.id !== row.id);
            return [row as Ride, ...without].sort((a, b) => b.requested_at.localeCompare(a.requested_at));
          });
          setLoaded(true);
        },
      )
      .subscribe();

    const poll = setInterval(() => document.visibilityState === 'visible' && void reload(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      aliveRef.current = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [role, userId, reload]);

  return { rides, loaded, reload };
}
