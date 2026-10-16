'use client';

import { useEffect, useRef, useState } from 'react';
import { TRACK_INTERVAL_MS } from '@/lib/constants';
import { toFix, toGeoError, geoSupported, type Fix, type GeoError } from '@/lib/geolocation';
import { getSupabase } from '@/lib/supabase/client';
import { errorCode } from '@/hooks/useErrorMessage';

interface Options {
  /** Track only while available or in a running ride. Stops completely otherwise. */
  active: boolean;
  /** Server says we may not publish anymore (no longer available / suspended). */
  onRejected?: (code: string) => void;
  onGeoError?: (e: GeoError) => void;
}

/**
 * watchPosition + a push to the server every ~12 s (10-15 s as specified).
 * We re-send the last known fix even if the phone did not move, so the server's freshness
 * check ("silent for 3 min = hidden") only trips when the app is really gone.
 */
export function useBodaTracking({ active, onRejected, onGeoError }: Options) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [lastFix, setLastFix] = useState<Fix | null>(null);
  const latest = useRef<Fix | null>(null);
  const lastSent = useRef(0);
  const inFlight = useRef(false);
  const cbRef = useRef({ onRejected, onGeoError });
  useEffect(() => {
    cbRef.current = { onRejected, onGeoError };
  });

  useEffect(() => {
    if (!active || !geoSupported()) {
      latest.current = null;
      setLastSentAt(null);
      return;
    }
    const supabase = getSupabase();
    let stopped = false;

    const push = async () => {
      const fix = latest.current;
      if (!fix || inFlight.current || stopped) return;
      if (Date.now() - lastSent.current < TRACK_INTERVAL_MS - 500) return;
      inFlight.current = true;
      try {
        const { error } = await supabase.rpc('update_location', {
          p_lat: fix.lat,
          p_lng: fix.lng,
          p_accuracy: Math.round(fix.accuracy),
        });
        if (error) {
          const code = errorCode(error);
          if (code === 'not_available' || code === 'boda_not_approved' || code === 'not_a_boda') {
            cbRef.current.onRejected?.(code);
          }
        } else {
          lastSent.current = Date.now();
          setLastSentAt(lastSent.current);
        }
      } catch {
        /* offline: the next tick retries */
      } finally {
        inFlight.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const fix = toFix(p);
        latest.current = fix;
        setLastFix(fix);
        void push();
      },
      (e) => cbRef.current.onGeoError?.(toGeoError(e)),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
    const tick = setInterval(push, 4_000);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
    };
  }, [active]);

  return { lastSentAt, lastFix };
}
