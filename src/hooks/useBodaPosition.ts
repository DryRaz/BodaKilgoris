'use client';

import { useEffect, useState } from 'react';
import { POLL_MS } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase/client';
import type { BodaLocation } from '@/lib/types';

/**
 * Live position of ONE Boda — allowed by RLS only for the client whose ride he accepted
 * (and for the Boda himself).
 */
export function useBodaPosition(bodaId: string | undefined, enabled: boolean) {
  const [position, setPosition] = useState<BodaLocation | null>(null);

  useEffect(() => {
    if (!bodaId || !enabled) {
      setPosition(null);
      return;
    }
    const supabase = getSupabase();
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('boda_locations').select('*').eq('boda_id', bodaId).maybeSingle();
      if (alive && data) setPosition(data as BodaLocation);
    };
    void load();
    const channel = supabase
      .channel(`boda-pos-${bodaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boda_locations', filter: `boda_id=eq.${bodaId}` },
        (payload) => {
          if (payload.eventType !== 'DELETE') setPosition(payload.new as BodaLocation);
        },
      )
      .subscribe();
    const poll = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [bodaId, enabled]);

  return position;
}
