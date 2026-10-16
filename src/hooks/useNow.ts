'use client';

import { useEffect, useState } from 'react';
import { serverNow } from '@/lib/clock';

/** Server-corrected "now" (ms), re-rendering every `everyMs`. */
export function useNow(everyMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(id);
  }, [everyMs, enabled]);
  return now;
}
