'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Map } from '@/components/map/Map';
import { RideStatusBadge } from '@/components/ride-status-badge';
import { useToast } from '@/components/toast';
import { Button, Card, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { destinationPoint } from '@/lib/ride-map';
import { getSupabase } from '@/lib/supabase/client';
import type { Ride } from '@/lib/types';
import { RideDetails } from './ride-details';

export function BodaActiveRide({
  ride, myPos, onChanged,
}: { ride: Ride; myPos: LatLng | null; onChanged: () => void }) {
  const t = useTranslations('boda');
  const tc = useTranslations('common');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const [busy, setBusy] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const [price, setPrice] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const pickup = { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const dest = destinationPoint(ride);

  async function run(label: string, fn: string, args: Record<string, unknown>) {
    setBusy(label);
    const { error } = await getSupabase().rpc(fn, args);
    if (error) toast.show(te(error), 'error');
    setBusy(null);
    setConfirmCancel(false);
    onChanged();
  }

  const arrivedAlready = ride.status === 'arrived';

  return (
    <Card className="space-y-3 border-2 border-brand-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-700">{t('currentRide')}</p>
          <p className="truncate text-2xl font-extrabold">{ride.client_name}</p>
        </div>
        <RideStatusBadge status={ride.status} />
      </div>

      <p className="text-base font-semibold text-brand-700">{arrivedAlready ? t('riding') : t('goToClient')}</p>

      <dl className="space-y-1 text-base">
        <RideDetails ride={ride} />
        {myPos && !arrivedAlready && (
          <div className="font-semibold">{t('distanceFromYou', { distance: fmt.distance(distanceMeters(myPos, pickup)) })}</div>
        )}
      </dl>

      <Map
        className="h-52 w-full"
        markers={[
          { id: 'pickup', ...pickup, kind: 'pickup', label: ride.client_name },
          ...(dest ? [{ id: 'destination', ...dest, kind: 'destination' as const }] : []),
          ...(myPos ? [{ id: 'me', ...myPos, kind: 'me' as const }] : []),
        ]}
        view={{ center: pickup, zoom: 16, key: ride.id }}
        fitKey={`${ride.id}:${myPos ? 1 : 0}:${dest ? 1 : 0}`}
      />

      {ride.client_phone && (
        <a
          href={`tel:${ride.client_phone}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 bg-white font-bold text-brand-700 active:bg-brand-50"
        >
          📞 {t('callClient', { name: ride.client_name })}
        </a>
      )}

      {ride.status === 'accepted' && (
        <Button size="lg" className="w-full" loading={busy === 'arrive'} onClick={() => run('arrive', 'arrive_ride', { p_ride_id: ride.id })}>
          {t('arrived')}
        </Button>
      )}

      {ride.status === 'arrived' && !pricing && (
        <Button size="lg" variant="accent" className="w-full" onClick={() => setPricing(true)}>
          {t('complete')}
        </Button>
      )}

      {ride.status === 'arrived' && pricing && (
        <div className="space-y-3 rounded-2xl bg-brand-50 p-3">
          <Field label={t('priceTitle')} hint={t('priceHint')}>
            {(id) => (
              <TextInput
                id={id}
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder={t('pricePlaceholder')}
              />
            )}
          </Field>
          <Button
            size="lg"
            className="w-full"
            loading={busy === 'complete'}
            onClick={() => run('complete', 'complete_ride', { p_ride_id: ride.id, p_price_kes: price ? Number(price) : null })}
          >
            {t('finish')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setPricing(false)}>{tc('back')}</Button>
        </div>
      )}

      {!confirmCancel ? (
        <Button variant="ghost" className="w-full text-danger" onClick={() => setConfirmCancel(true)}>{t('cancelRide')}</Button>
      ) : (
        <div className="space-y-2 rounded-2xl bg-danger-50 p-3">
          <p className="text-center font-semibold text-danger">{t('cancelConfirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>{tc('no')}</Button>
            <Button variant="danger" loading={busy === 'cancel'} onClick={() => run('cancel', 'cancel_ride', { p_ride_id: ride.id })}>
              {tc('yes')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
