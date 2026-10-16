'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Map } from '@/components/map/Map';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Spinner } from '@/components/ui';
import { useBodaPosition } from '@/hooks/useBodaPosition';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { useNow } from '@/hooks/useNow';
import { distanceMeters, etaMinutes } from '@/lib/geo';
import { getSupabase } from '@/lib/supabase/client';
import type { Ride } from '@/lib/types';

export function ClientActiveRide({ ride, onChanged }: { ride: Ride; onChanged: () => void }) {
  const t = useTranslations('client');
  const tc = useTranslations('common');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const now = useNow(1000);
  const pos = useBodaPosition(ride.boda_id, true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const waiting = ride.status === 'requested';
  const remaining = Math.max(0, Math.round((Date.parse(ride.expires_at) - now) / 1000));
  const pickup = { lat: ride.pickup_lat, lng: ride.pickup_lng };

  // the request just timed out: let the server expire it right away instead of waiting for the next sweep
  const sweptFor = useRef<string | null>(null);
  useEffect(() => {
    if (!waiting || remaining > 0 || sweptFor.current === ride.id) return;
    sweptFor.current = ride.id;
    void getSupabase().rpc('sweep_rides').then(() => onChanged());
  }, [waiting, remaining, ride.id, onChanged]);

  async function cancel() {
    setCancelling(true);
    const { error } = await getSupabase().rpc('cancel_ride', { p_ride_id: ride.id });
    if (error) toast.show(te(error), 'error');
    setCancelling(false);
    setConfirmCancel(false);
    onChanged();
  }

  const eta = pos ? etaMinutes(distanceMeters(pos, pickup)) : null;

  return (
    <div className="space-y-4">
      <Card className={`space-y-3 border-2 ${waiting ? 'border-accent-400' : 'border-brand-500'}`}>
        {waiting ? (
          <>
            <div className="flex items-center gap-3">
              <Spinner className="size-7 text-accent-500" />
              <h2 className="text-2xl font-extrabold">{t('waitingTitle', { name: ride.boda_name })}</h2>
            </div>
            <p className="text-base text-muted">{t('waitingBody', { time: fmt.countdown(remaining) })}</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold">
              {ride.status === 'arrived' ? t('hasArrived', { name: ride.boda_name }) : t('onTheWay', { name: ride.boda_name })}
            </h2>
            {ride.status === 'accepted' && eta !== null && <p className="text-lg font-semibold text-brand-700">{t('eta', { minutes: eta })}</p>}
            <div className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl">
                {ride.boda_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ride.boda_photo_url} alt="" className="size-full object-cover" />
                ) : (
                  <span aria-hidden>🏍️</span>
                )}
              </span>
              <p className="font-semibold">{t('plate', { plate: ride.boda_plate })}</p>
            </div>
            {ride.boda_phone && (
              <a
                href={`tel:${ride.boda_phone}`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 bg-white font-bold text-brand-700 active:bg-brand-50"
              >
                📞 {t('callBoda', { name: ride.boda_name })}
              </a>
            )}
          </>
        )}
      </Card>

      <Map
        className="h-[40dvh] min-h-60 w-full"
        markers={[
          { id: 'pickup', ...pickup, kind: 'pickup' },
          ...(pos ? [{ id: 'boda', lat: pos.lat, lng: pos.lng, kind: 'boda' as const, label: ride.boda_name }] : []),
        ]}
        view={{ center: pickup, zoom: 16, key: ride.id }}
        fitKey={`${ride.id}:${pos ? 1 : 0}`}
      />

      {!confirmCancel ? (
        <Button variant="secondary" className="w-full" onClick={() => setConfirmCancel(true)}>
          {waiting ? t('cancelRequest') : t('cancelRide')}
        </Button>
      ) : (
        <Banner kind="warn">
          <p className="mb-2 text-center">{t('cancelConfirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>{tc('no')}</Button>
            <Button variant="danger" loading={cancelling} onClick={() => void cancel()}>{tc('yes')}</Button>
          </div>
        </Banner>
      )}
    </div>
  );
}
