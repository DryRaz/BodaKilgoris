'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Pulls an error code out of whatever we caught (API JSON, Supabase error, string, Error). */
export function errorCode(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as { error?: unknown; message?: unknown; code?: unknown };
    if (typeof e.error === 'string') return e.error;
    if (typeof e.message === 'string') return e.message;
  }
  return null;
}

/**
 * Maps an error to a translated message. The database and API raise stable
 * snake_case codes (e.g. "boda_unavailable") that exist under `errors.*` in en/sw.json.
 */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (err: unknown): string => {
      const code = errorCode(err);
      if (code && t.has(code as never)) return t(code as never);
      if (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof TypeError && /fetch|network/i.test(err.message)) ||
        (code && /failed to fetch|networkerror|load failed/i.test(code))
      ) {
        return t('network');
      }
      // the user only sees the generic text; the real error goes to the browser console
      console.error('[boda] generic error shown. Raw error:', err);
      return t('generic');
    },
    [t],
  );
}
