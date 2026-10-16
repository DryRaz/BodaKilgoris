'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { AvailableBoda } from '@/lib/types';

const REFETCH_MS = 15_000;

/**
 * Bodas currently available, with live positions.
 *  - list + names + ratings: available_bodas() RPC (the only place that exposes them)
 *  - movement: Realtime on boda_locations (RLS already hides unavailable Bodas)
 *  - a Boda we do not know yet (just went online) triggers a refetch
 */
export function useAvailableBodas(enabled: boolean) {
  const [bodas, setBodas] = useState<AvailableBoda[]>([]);
  const [loaded, setLoaded] = useState(false);
  const known = useRef(new Set<string>());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await getSupabase().rpc('available_bodas');
    if (error) return;
    const rows = (data ?? []) as AvailableBoda[];
    known.current = new Set(rows.map((b) => b.id));
    setBodas(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    void reload();

    const scheduleReload = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void reload(), 400);
    };

    const channel = supabase
      .channel(`boda-locations-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boda_locations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { boda_id?: string }).boda_id;
          if (id) {
            known.current.delete(id);
            setBodas((prev) => prev.filter((b) => b.id !== id));
          }
          return;
        }
        const row = payload.new as { boda_id: string; lat: number; lng: number; updated_at: string };
        if (!known.current.has(row.boda_id)) return scheduleReload();
        setBodas((prev) =>
          prev.map((b) => (b.id === row.boda_id ? { ...b, lat: row.lat, lng: row.lng, updated_at: row.updated_at } : b)),
        );
      })
      .subscribe();

    const poll = setInterval(() => document.visibilityState === 'visible' && void reload(), REFETCH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      if (debounce.current) clearTimeout(debounce.current);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  return { bodas, loaded, reload };
}
