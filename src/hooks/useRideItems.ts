'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_MS } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase/client';
import type { RideItem } from '@/lib/types';

/**
 * The lines of one shopping order: Realtime for instant "bought / not found / replaced" updates plus a light
 * poll and a refetch on return to the foreground, like useMyRides.
 */
export function useRideItems(rideId: string | undefined, enabled = true) {
  const [items, setItems] = useState<RideItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!rideId) return;
    const { data, error } = await getSupabase().from('ride_items').select('*').eq('ride_id', rideId).order('position');
    if (!error && alive.current) {
      setItems((data ?? []) as RideItem[]);
      setLoaded(true);
    }
  }, [rideId]);

  useEffect(() => {
    alive.current = true;
    if (!rideId || !enabled) return;
    const supabase = getSupabase();
    void reload();
    const channel = supabase
      .channel(`ride-items-${rideId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_items', filter: `ride_id=eq.${rideId}` }, () => void reload())
      .subscribe();
    const poll = setInterval(() => document.visibilityState === 'visible' && void reload(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [rideId, enabled, reload]);

  return { items, loaded, reload };
}
