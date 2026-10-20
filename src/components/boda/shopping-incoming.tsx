'use client';

import { useTranslations } from 'next-intl';
import { Map } from '@/components/map/Map';
import { ItemsList } from '@/components/shopping-items';
import { Banner, Button, Card } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useRideItems } from '@/hooks/useRideItems';
import { distanceMeters, type LatLng } from '@/lib/geo';
import type { Ride } from '@/lib/types';

/** Incoming SHOPPING request: badge, item count, the whole list, budget, delivery place. The client's phone is not shown yet. */
export function ShoppingIncoming({
  ride, myPos, remainingSeconds, busy, onAccept, onDecline,
}: {
  ride: Ride;
  myPos: LatLng | null;
  remainingSeconds: number;
  busy: 'accept' | 'decline' | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations('shoppingBoda');
  const tb = useTranslations('boda');
  const fmt = useFormat();
  const { items, loaded } = useRideItems(ride.id);
  const place = { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const urgent = remainingSeconds <= 30;

  return (
    <Card className="space-y-3 border-2 border-accent-400" data-testid="incoming-shopping">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-accent-400 px-3 py-1 text-sm font-extrabold text-[#1a1200]" data-testid="shopping-badge">🛒 {t('badge')}</span>
          <p className="mt-1 truncate text-2xl font-extrabold">{ride.client_name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${urgent ? 'bg-danger-50 text-danger' : 'bg-warn-50 text-[#7a5a00]'}`}>
          {tb('expiresIn', { time: fmt.countdown(remainingSeconds) })}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-extrabold" data-testid="items-count">{t('itemsCount', { count: ride.items_count })}</p>
        <p className="text-base font-semibold">
          {ride.budget_max_kes !== null ? t('budget', { amount: fmt.ksh(ride.budget_max_kes) }) : <span className="text-muted">{t('noBudget')}</span>}
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-2xl">
        {loaded ? <ItemsList items={items} showStatus={false} /> : <p className="text-muted">…</p>}
      </div>

      <dl className="space-y-1 text-base">
        {ride.delivery_landmark && (
          <div className="flex gap-2"><dt className="font-semibold">{t('landmark')}:</dt><dd className="min-w-0 break-words">{ride.delivery_landmark}</dd></div>
        )}
        {ride.client_note && (
          <div className="flex gap-2"><dt className="font-semibold">{t('note')}:</dt><dd className="min-w-0 break-words">{ride.client_note}</dd></div>
        )}
        {myPos && <div className="font-semibold text-brand-700">{tb('distanceFromYou', { distance: fmt.distance(distanceMeters(myPos, place)) })}</div>}
      </dl>

      <div>
        <p className="mb-1 text-sm font-semibold text-muted">{t('deliveryPoint')}</p>
        <Map
          className="h-40 w-full"
          interactive={false}
          markers={[
            { id: 'pickup', ...place, kind: 'pickup', label: ride.client_name },
            ...(myPos ? [{ id: 'me', ...myPos, kind: 'me' as const }] : []),
          ]}
          view={{ center: place, zoom: 16, key: ride.id }}
          fitKey={`${ride.id}:${myPos ? 1 : 0}`}
        />
      </div>

      <Banner kind="warn">{t('advanceNotice')}</Banner>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" loading={busy === 'decline'} disabled={busy !== null} onClick={onDecline}>{tb('decline')}</Button>
        <Button size="lg" loading={busy === 'accept'} disabled={busy !== null} onClick={onAccept}>{tb('accept')}</Button>
      </div>
    </Card>
  );
}
