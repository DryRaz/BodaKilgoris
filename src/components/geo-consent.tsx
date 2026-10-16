'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth } from './auth-provider';
import { Button } from './ui';

/**
 * Explicit consent before the first geolocation use. Stored on the profile
 * (profiles.geo_consent_at) so it follows the account across devices.
 *   const consent = useGeoConsent('client');
 *   if (!(await consent.request())) return;     // ...and render {consent.dialog}
 */
export function useGeoConsent(variant: 'boda' | 'client'): {
  hasConsent: boolean;
  request: () => Promise<boolean>;
  dialog: ReactNode;
} {
  const { profile, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const hasConsent = !!profile?.geo_consent_at;

  const request = useCallback(() => {
    if (hasConsent) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, [hasConsent]);

  const finish = useCallback((ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const accept = useCallback(async () => {
    setBusy(true);
    const { error } = await getSupabase().rpc('set_geo_consent', { p_given: true });
    if (!error) await refresh();
    setBusy(false);
    finish(!error);
  }, [refresh, finish]);

  const dialog = open ? (
    <GeoConsentDialog variant={variant} busy={busy} onAccept={accept} onDecline={() => finish(false)} />
  ) : null;

  return { hasConsent, request, dialog };
}

function GeoConsentDialog({
  variant, busy, onAccept, onDecline,
}: { variant: 'boda' | 'client'; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const t = useTranslations('geo');
  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="geo-title">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-5xl" aria-hidden>📍</div>
        <h2 id="geo-title" className="text-2xl font-extrabold">{t('consentTitle')}</h2>
        <p className="text-base leading-relaxed">{variant === 'boda' ? t('consentBodyBoda') : t('consentBodyClient')}</p>
        <div className="space-y-3">
          <Button size="lg" className="w-full" loading={busy} onClick={onAccept}>{t('allow')}</Button>
          <Button variant="secondary" className="w-full" onClick={onDecline} disabled={busy}>{t('notNow')}</Button>
        </div>
      </div>
    </div>
  );
}
