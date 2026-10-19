'use client';

import { useEffect } from 'react';
import { logClient } from '@/lib/clientlog';

/**
 * Tells us (in the server log) when the app was re-created by the browser: a discarded/killed tab or a
 * reload. If Bodas keep "restarting" after the camera, this shows how often, on which device, and whether
 * it was Chrome discarding the page (low memory) or something in the app navigating by itself.
 */
export function ReloadDiagnostics() {
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const wasDiscarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
      if (wasDiscarded || nav?.type === 'reload') {
        logClient('app.restarted', { wasDiscarded, navType: nav?.type }, 'warn');
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
