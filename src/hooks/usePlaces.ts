'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { Place } from '@/lib/types';

/**
 * Active frequent places (the shortcut chips under the destination field). Loaded once; shortcuts are a convenience, never a requirement,
 * so a failure leaves the list empty, but it is always logged (never silent).
 */
export function usePlaces(): Place[] {
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    let alive = true;
    void getSupabase()
      .from('places')
      .select('id, name, lat, lng, active')
      .eq('active', true)
      .order('name')
      .limit(40)
      .then(({ data, error }) => {
        if (error) console.error('[boda] places load failed', { message: error.message, code: error.code, details: error.details, hint: error.hint });
        if (alive && !error && data) setPlaces(data as Place[]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return places;
}
