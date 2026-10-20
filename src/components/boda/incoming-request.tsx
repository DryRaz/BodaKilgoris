'use client';

import { useTranslations } from 'next-intl';
import { Map } from '@/components/map/Map';
import { Button, Card } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { destinationPoint } from '@/lib/ride-map';
import type { Ride } from '@/lib/types';
import { RideDetails } from './ride-details';

export function IncomingRequest({
  ride, myPos, remainingSeconds, busy, onAccept, onDecline,
}: {
  ride: Ride;
  myPos: LatLng | null;
  remainingSeconds: number;
  busy: 'accept' | 'decline' | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations('boda');
  const fmt = useFormat();
  const pickup = { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const dest = destinationPoint(ride);
  const urgent = remainingSeconds <= 30;

  return (
    <Card className="space-y-3 border-2 border-accent-400">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-accent-500">{t('incomingTitle')}</p>
          <p className="truncate text-2xl font-extrabold">{ride.client_name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${urgent ? 'bg-danger-50 text-danger' : 'bg-warn-50 text-[#7a5a00]'}`}>
          {t('expiresIn', { time: fmt.countdown(remainingSeconds) })}
        </span>
      </div>

      <dl className="space-y-1 text-base">
        <RideDetails ride={ride} />
        {myPos && (
          <div className="font-semibold text-brand-700">{t('distanceFromYou', { distance: fmt.distance(distanceMeters(myPos, pickup)) })}</div>
        )}
      </dl>

      <div>
        <p className="mb-1 text-sm font-semibold text-muted">{t('pickupPoint')}</p>
        <Map
          className="h-44 w-full"
          interactive={false}
          markers={[
            { id: 'pickup', ...pickup, kind: 'pickup', label: ride.client_name },
            ...(dest ? [{ id: 'destination', ...dest, kind: 'destination' as const }] : []),
            ...(myPos ? [{ id: 'me', ...myPos, kind: 'me' as const }] : []),
          ]}
          view={{ center: pickup, zoom: 16, key: ride.id }}
          fitKey={`${ride.id}:${myPos ? 1 : 0}:${dest ? 1 : 0}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" loading={busy === 'decline'} disabled={busy !== null} onClick={onDecline}>
          {t('decline')}
        </Button>
        <Button size="lg" loading={busy === 'accept'} disabled={busy !== null} onClick={onAccept}>
          {t('accept')}
        </Button>
      </div>
    </Card>
  );
}
