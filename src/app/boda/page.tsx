'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { useRequireRole } from '@/components/auth-provider';
import { AvailabilityToggle } from '@/components/boda/availability-toggle';
import { BodaActiveRide } from '@/components/boda/active-ride';
import { IncomingRequest } from '@/components/boda/incoming-request';
import { ReceiptsBanner } from '@/components/boda/receipts-banner';
import { BodaShoppingOrder } from '@/components/boda/shopping-order';
import { useGeoConsent } from '@/components/geo-consent';
import { PhotoUploader } from '@/components/photo-picker';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Stars } from '@/components/ui';
import { useBodaTracking } from '@/hooks/useBodaTracking';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useMyRides } from '@/hooks/useMyRides';
import { useNow } from '@/hooks/useNow';
import { useSweep } from '@/hooks/useSweep';
import { useWakeLock } from '@/hooks/useWakeLock';
import { nairobiDay } from '@/lib/clock';
import { AUTO_CONFIRM_MINUTES } from '@/lib/constants';
import { GeoError, getPosition } from '@/lib/geolocation';
import { RUNNING_RIDE_STATUSES } from '@/lib/types';
import { alertNewRequest, ensureNotificationPermission } from '@/lib/notify';
import { getSupabase } from '@/lib/supabase/client';

export default function BodaHomePage() {
  const t = useTranslations('boda');
  const tg = useTranslations('geo');
  const tn = useTranslations('notify');
  const te = useErrorMessage();
  const toast = useToast();
  const { ready, user, profile, boda, refresh } = useRequireRole('boda');
  const consent = useGeoConsent('boda');

  const { rides, reload } = useMyRides('boda', user?.id);
  const [switching, setSwitching] = useState(false);
  const [answering, setAnswering] = useState<{ id: string; action: 'accept' | 'decline' } | null>(null);

  const approved = boda?.status === 'approved';
  const available = !!boda?.is_available;
  const now = useNow(1000, ready);

  const onSwept = useCallback(() => {
    void reload();
    void refresh();
  }, [reload, refresh]);
  useSweep(ready, onSwept);

  const current = rides.find((r) => RUNNING_RIDE_STATUSES.includes(r.status));
  const pending = useMemo(
    () =>
      rides
        .filter((r) => r.status === 'requested' && Date.parse(r.expires_at) > now)
        .sort((a, b) => a.requested_at.localeCompare(b.requested_at)),
    [rides, now],
  );
  const lastCompleted = rides.find((r) => r.status === 'completed');
  const showLastCompleted =
    !!lastCompleted &&
    !current &&
    (!lastCompleted.counted || now - Date.parse(lastCompleted.completed_at ?? '') < 10 * 60_000);

  const today = nairobiDay(now);
  const ridesToday = rides.filter((r) => r.status === 'completed' && r.completed_at && nairobiDay(r.completed_at) === today).length;

  // ---- GPS: only while available or in a running ride; stops completely otherwise ----
  const tracking = useBodaTracking({
    active: ready && approved && (available || !!current),
    onRejected: () => void refresh(),
    onGeoError: (e) => toast.show(tg(e.code === 'denied' ? 'denied' : e.code === 'timeout' ? 'timeout' : 'unavailable'), 'error'),
  });
  useWakeLock(ready && available);
  const myPos = tracking.lastFix;

  // ---- own account row: approval / suspension / auto-offline arrive live ----
  // depends on the id (a string), not on the `user` object: that object is a new instance after every
  // session read, which used to tear the Realtime channel down and rebuild it on each refresh.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`my-boda-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'boda_profiles', filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [userId, refresh]);

  // ---- alert on every new request ----
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const r of pending) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      alertNewRequest(tn('newRequest'), `${r.client_name} · ${tn('tapToOpen')}`, r.id);
    }
  }, [pending, tn]);

  async function goOnline() {
    if (!(await consent.request())) {
      toast.show(tg('denied'), 'error');
      return;
    }
    setSwitching(true);
    try {
      const fix = await getPosition();
      const { error } = await getSupabase().rpc('set_availability', {
        p_available: true, p_lat: fix.lat, p_lng: fix.lng, p_accuracy: Math.round(fix.accuracy),
      });
      if (error) throw error;
      await refresh();
      void ensureNotificationPermission();
    } catch (e) {
      toast.show(e instanceof GeoError ? tg(e.code === 'denied' ? 'denied' : e.code === 'timeout' ? 'timeout' : e.code === 'unsupported' ? 'unsupported' : 'unavailable') : te(e), 'error');
    } finally {
      setSwitching(false);
    }
  }

  async function goOffline() {
    setSwitching(true);
    const { error } = await getSupabase().rpc('set_availability', { p_available: false });
    if (error) toast.show(te(error), 'error');
    await refresh();
    setSwitching(false);
  }

  async function answer(id: string, action: 'accept' | 'decline') {
    setAnswering({ id, action });
    const { error } = await getSupabase().rpc(action === 'accept' ? 'accept_ride' : 'decline_ride', { p_ride_id: id });
    if (error) toast.show(te(error), 'error');
    await Promise.all([reload(), refresh()]);
    setAnswering(null);
  }

  if (!ready) return (<><AppHeader /><Loading /></>);

  const sentAgo = tracking.lastSentAt ? Math.max(0, Math.round((now - tracking.lastSentAt) / 1000)) : null;

  return (
    <>
      <AppHeader
        title={t('greeting', { name: profile!.name.split(' ')[0] })}
        right={<Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full text-2xl active:bg-brand-50">⚙️</Link>}
      />
      <Page>
        {current?.type === 'shopping' && <ReceiptsBanner />}

        {boda && !boda.photo_url && (
          <Card className="space-y-3">
            <h2 className="text-xl font-extrabold">{t('addPhotoTitle')}</h2>
            <p className="text-base">{t('addPhotoBody')}</p>
            <PhotoUploader onUploaded={() => void refresh()} />
          </Card>
        )}

        {boda?.status === 'pending' && (
          <Card className="space-y-3 text-center">
            <div className="text-5xl" aria-hidden>⏳</div>
            <h2 className="text-2xl font-extrabold">{t('pendingTitle')}</h2>
            <p className="text-base">{t('pendingBody')}</p>
            <Button variant="secondary" onClick={() => void refresh()}>{t('refresh')}</Button>
          </Card>
        )}

        {boda?.status === 'suspended' && (
          <Card className="space-y-2 border-danger/40 bg-danger-50 text-center">
            <div className="text-5xl" aria-hidden>⛔</div>
            <h2 className="text-2xl font-extrabold text-danger">{t('suspendedTitle')}</h2>
            <p className="text-base">{t('suspendedBody')}</p>
          </Card>
        )}

        {approved && (
          <>
            {!current && (
              <>
                <AvailabilityToggle available={available} busy={switching} onToggle={available ? goOffline : goOnline} />
                <p className="px-1 text-base text-muted">{available ? t('onlineHint') : t('offlineHint')}</p>
              </>
            )}

            {available && !current && (
              <div className="space-y-1 rounded-xl bg-brand-50 px-4 py-3 text-sm">
                <p className="font-semibold text-brand-900">
                  📡 {sentAgo === null ? t('trackingWaiting') : t('tracking', { seconds: sentAgo })}
                </p>
                <p className="text-muted">{t('keepScreenOn')}</p>
              </div>
            )}

            {current && (current.type === 'shopping'
              ? <BodaShoppingOrder ride={current} myPos={myPos} onChanged={() => void Promise.all([reload(), refresh()])} />
              : <BodaActiveRide ride={current} myPos={myPos} onChanged={() => void Promise.all([reload(), refresh()])} />)}

            {!current &&
              pending.map((r) => (
                <IncomingRequest
                  key={r.id}
                  ride={r}
                  myPos={myPos}
                  remainingSeconds={Math.max(0, Math.round((Date.parse(r.expires_at) - now) / 1000))}
                  busy={answering?.id === r.id ? answering.action : answering ? 'decline' : null}
                  onAccept={() => void answer(r.id, 'accept')}
                  onDecline={() => void answer(r.id, 'decline')}
                />
              ))}

            {available && !current && pending.length === 0 && (
              <Card className="text-center text-muted">{t('noRequests')}</Card>
            )}
            {!available && !current && pending.length === 0 && !showLastCompleted && (
              <Card className="text-center text-muted">{t('tapAvailable')}</Card>
            )}

            {showLastCompleted && lastCompleted && (
              <Card className={lastCompleted.counted ? 'border-brand-500 bg-brand-50' : ''}>
                <p className="text-lg font-extrabold">
                  {lastCompleted.counted ? t('counted') : t('justFinished')} · {lastCompleted.client_name}
                </p>
                {!lastCompleted.counted && <p className="mt-1 text-base text-muted">{t('waitingConfirm', { minutes: AUTO_CONFIRM_MINUTES })}</p>}
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card className="text-center">
                <p className="text-sm font-semibold text-muted">{t('ridesToday')}</p>
                <p className="text-4xl font-extrabold tabular-nums">{ridesToday}</p>
              </Card>
              <Card className="text-center">
                <p className="text-sm font-semibold text-muted">{t('yourRating')}</p>
                {boda && boda.rating_count > 0 ? (
                  <div className="mt-2"><Stars value={Number(boda.rating_avg)} count={boda.rating_count} /></div>
                ) : (
                  <p className="mt-2 text-base text-muted">{t('noRating')}</p>
                )}
              </Card>
            </div>
          </>
        )}

        {!approved && boda?.status !== 'pending' && boda?.status !== 'suspended' && <Banner kind="warn">{t('pendingBody')}</Banner>}
      </Page>
      {consent.dialog}
    </>
  );
}
