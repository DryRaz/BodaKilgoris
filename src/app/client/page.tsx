'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { useRequireRole } from '@/components/auth-provider';
import { ClientActiveRide } from '@/components/client/active-ride';
import { BodasBrowser } from '@/components/client/bodas-browser';
import { ConfirmCard } from '@/components/client/confirm-card';
import { useGeoConsent } from '@/components/geo-consent';
import { useToast } from '@/components/toast';
import { useMyRides } from '@/hooks/useMyRides';
import { useSweep } from '@/hooks/useSweep';
import { alertNewRequest } from '@/lib/notify';
import type { RideStatus } from '@/lib/types';

export default function ClientHomePage() {
  const t = useTranslations('client');
  const tn = useTranslations('notify');
  const toast = useToast();
  const { ready, user, profile } = useRequireRole('client');
  const consent = useGeoConsent('client');
  const { rides, loaded, reload } = useMyRides('client', user?.id);
  useSweep(ready, reload);

  const active = rides.find((r) => r.status === 'requested' || r.status === 'accepted' || r.status === 'arrived');
  const toConfirm = rides.find((r) => r.status === 'completed' && !r.client_confirmed);

  // tell the client when something happens to their ride (sound + toast + system notification)
  const previous = useRef(new Map<string, RideStatus>());
  const primed = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    for (const r of rides) {
      const before = previous.current.get(r.id);
      previous.current.set(r.id, r.status);
      if (!primed.current || !before || before === r.status) continue;
      const name = r.boda_name;
      if (r.status === 'accepted') alertNewRequest(tn('accepted', { name }), tn('tapToOpen'), r.id);
      else if (r.status === 'arrived') alertNewRequest(tn('arrived', { name }), tn('tapToOpen'), r.id);
      else if (r.status === 'completed') alertNewRequest(tn('completed'), tn('tapToOpen'), r.id);
      else if (r.status === 'declined') toast.show(t('declined', { name }), 'error');
      else if (r.status === 'expired') toast.show(t('expired', { name }), 'error');
      else if (r.status === 'cancelled' && r.cancelled_by === 'boda') toast.show(t('cancelledByBoda', { name }), 'error');
    }
    primed.current = true;
  }, [rides, loaded, t, tn, toast]);

  if (!ready) return (<><AppHeader /><Loading /></>);

  return (
    <>
      <AppHeader
        title={t('hello', { name: profile!.name.split(' ')[0] })}
        right={<Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full text-2xl active:bg-brand-50">⚙️</Link>}
      />
      <Page>
        {!loaded ? (
          <Loading />
        ) : active ? (
          <ClientActiveRide ride={active} onChanged={() => void reload()} />
        ) : toConfirm ? (
          <ConfirmCard ride={toConfirm} onDone={() => void reload()} />
        ) : (
          <BodasBrowser requestConsent={consent.request} onRequested={() => void reload()} />
        )}
      </Page>
      {consent.dialog}
    </>
  );
}
