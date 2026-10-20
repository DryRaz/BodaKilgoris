'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { useRequireRole } from '@/components/auth-provider';
import { ClientActiveRide } from '@/components/client/active-ride';
import { BodasBrowser } from '@/components/client/bodas-browser';
import { ConfirmCard } from '@/components/client/confirm-card';
import { HomeChoice } from '@/components/client/home-choice';
import { ShoppingFlow } from '@/components/client/shopping-flow';
import { useGeoConsent } from '@/components/geo-consent';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useMyRides } from '@/hooks/useMyRides';
import { useShoppingDraft } from '@/hooks/useShoppingDraft';
import { useSweep } from '@/hooks/useSweep';
import { alertNewRequest } from '@/lib/notify';
import { ACTIVE_RIDE_STATUSES, type RideStatus } from '@/lib/types';

export default function ClientHomePage() {
  const t = useTranslations('client');
  const tn = useTranslations('notify');
  const toast = useToast();
  const { ready, user, profile } = useRequireRole('client');
  const consent = useGeoConsent('client');
  const fmt = useFormat();
  const { rides, loaded, reload } = useMyRides('client', user?.id);
  useSweep(ready, reload);
  const shopping = useShoppingDraft();
  const [mode, setMode] = useState<'home' | 'ride'>('home');

  const active = rides.find((r) => ACTIVE_RIDE_STATUSES.includes(r.status));
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
      else if (r.status === 'shopping') alertNewRequest(tn('shoppingStarted', { name }), tn('tapToOpen'), r.id);
      else if (r.status === 'purchased') {
        alertNewRequest(tn('shoppingDone', { name, amount: fmt.ksh(r.items_total_kes ?? 0) }), tn('tapToOpen'), r.id);
      } else if (r.status === 'delivering') alertNewRequest(tn('delivering', { name }), tn('tapToOpen'), r.id);
      else if (r.status === 'completed') alertNewRequest(r.type === 'shopping' ? tn('deliveredConfirm') : tn('completed'), tn('tapToOpen'), r.id);
      else if (r.status === 'declined') toast.show(t('declined', { name }), 'error');
      else if (r.status === 'expired') toast.show(t('expired', { name }), 'error');
      else if (r.status === 'cancelled' && r.cancelled_by === 'boda') toast.show(t('cancelledByBoda', { name }), 'error');
    }
    primed.current = true;
  }, [rides, loaded, t, tn, toast, fmt]);

  // the list is forgotten only once the order it was sent as is finished (delivered): a refusal / expiry / cancellation keeps it
  const sent = shopping.draft.sentRideId;
  const clearDraft = shopping.clear;
  useEffect(() => {
    if (sent && rides.some((r) => r.id === sent && r.status === 'completed')) clearDraft();
  }, [sent, rides, clearDraft]);

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
          <ConfirmCard ride={toConfirm} onDone={() => { if (toConfirm.type === 'shopping') shopping.clear(); void reload(); }} />
        ) : !shopping.ready ? (
          <Loading />
        ) : shopping.draft.view === 'shopping' ? (
          <ShoppingFlow
            draft={shopping.draft}
            update={shopping.update}
            onHome={() => { setMode('home'); shopping.update({ view: 'home' }); }}
            onStartOver={shopping.clear}
            requestConsent={consent.request}
            onRequested={(rideId) => { shopping.update({ sentRideId: rideId }); void reload(); }}
          />
        ) : mode === 'ride' ? (
          <>
            <Button variant="ghost" onClick={() => setMode('home')} className="-ml-3">← {t('home')}</Button>
            <BodasBrowser requestConsent={consent.request} onRequested={() => void reload()} />
          </>
        ) : (
          <HomeChoice
            resumeCount={shopping.draft.lines.length}
            onRide={() => setMode('ride')}
            onShopping={() => shopping.update({ view: 'shopping' })}
          />
        )}
      </Page>
      {consent.dialog}
    </>
  );
}
