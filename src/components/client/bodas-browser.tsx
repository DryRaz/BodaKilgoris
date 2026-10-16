'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map } from '@/components/map/Map';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Stars, TextInput } from '@/components/ui';
import { useAvailableBodas } from '@/hooks/useAvailableBodas';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { KILGORIS_CENTER } from '@/lib/constants';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { GeoError, getPosition } from '@/lib/geolocation';
import { getSupabase } from '@/lib/supabase/client';
import type { AvailableBoda } from '@/lib/types';

type Pickup = LatLng & { source: 'gps' | 'pin' };

export function BodasBrowser({
  requestConsent, onRequested,
}: { requestConsent: () => Promise<boolean>; onRequested: () => void }) {
  const t = useTranslations('client');
  const tg = useTranslations('geo');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();

  const { bodas, loaded, reload } = useAvailableBodas(true);
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [viewKey, setViewKey] = useState('init');
  const [locating, setLocating] = useState(false);
  const [destination, setDestination] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const autoLocated = useRef(false);

  const locate = useCallback(
    async (userInitiated: boolean) => {
      if (!(await requestConsent())) {
        if (userInitiated) toast.show(tg('denied'), 'error');
        return;
      }
      setLocating(true);
      try {
        const fix = await getPosition();
        setPickup({ lat: fix.lat, lng: fix.lng, source: 'gps' });
        setViewKey(`gps-${Date.now()}`);
      } catch (e) {
        if (userInitiated || (e instanceof GeoError && e.code === 'denied')) {
          const code = e instanceof GeoError ? e.code : 'unavailable';
          toast.show(tg(code === 'denied' ? 'denied' : code === 'timeout' ? 'timeout' : code === 'unsupported' ? 'unsupported' : 'unavailable'), 'error');
        }
      } finally {
        setLocating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestConsent],
  );

  // First visit: ask for consent + position straight away (pin on the map remains possible)
  useEffect(() => {
    if (autoLocated.current) return;
    autoLocated.current = true;
    void locate(false);
  }, [locate]);

  const origin: LatLng = pickup ?? KILGORIS_CENTER;
  const list = useMemo(
    () =>
      bodas
        .map((b) => ({ boda: b, meters: distanceMeters(origin, b) }))
        .sort((a, b) => a.meters - b.meters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bodas, origin.lat, origin.lng],
  );

  const markers = useMemo(
    () => [
      ...list.map(({ boda }) => ({
        id: boda.id, lat: boda.lat, lng: boda.lng, label: boda.name,
        kind: (boda.id === selectedId ? 'bodaSelected' : 'boda') as 'bodaSelected' | 'boda',
      })),
      ...(pickup ? [{ id: 'pickup', lat: pickup.lat, lng: pickup.lng, kind: 'pickup' as const }] : []),
    ],
    [list, pickup, selectedId],
  );

  async function request(b: AvailableBoda) {
    if (!pickup) {
      toast.show(t('tapMap'), 'info');
      return;
    }
    setRequesting(b.id);
    const { error } = await getSupabase().rpc('request_ride', {
      p_boda_id: b.id, p_lat: pickup.lat, p_lng: pickup.lng, p_destination: destination.trim() || null,
    });
    if (error) {
      toast.show(te(error), 'error');
      void reload();
    } else {
      onRequested();
    }
    setRequesting(null);
  }

  return (
    <>
      <div className="space-y-2">
        <Map
          className="h-[44dvh] min-h-64 w-full"
          markers={markers}
          view={{ center: origin, zoom: 15, key: viewKey }}
          fitKey={`${list.length}:${pickup ? 1 : 0}`}
          onTap={(p) => {
            setPickup({ ...p, source: 'pin' });
            setSelectedId(null);
          }}
          onMarkerClick={(id) => id !== 'pickup' && setSelectedId(id)}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {pickup ? `📍 ${pickup.source === 'gps' ? t('pickupGps') : t('pickupPin')}` : t('tapMap')}
          </p>
          <Button variant="secondary" loading={locating} onClick={() => void locate(true)} className="shrink-0">
            {locating ? t('locating') : t('useMyLocation')}
          </Button>
        </div>
      </div>

      <Field label={t('destinationLabel')}>
        {(id) => (
          <TextInput
            id={id}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t('destinationPlaceholder')}
            maxLength={200}
            autoComplete="off"
          />
        )}
      </Field>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">{t('bodasNow')} ({list.length})</h2>
        <Button variant="ghost" onClick={() => void reload()}>{t('refreshList')}</Button>
      </div>

      {loaded && list.length === 0 && <Card className="text-center text-muted">{t('noBodas')}</Card>}

      <ul className="space-y-3">
        {list.map(({ boda, meters }) => (
          <li key={boda.id}>
            <Card className={`space-y-3 ${boda.id === selectedId ? 'border-2 border-accent-500 bg-warn-50' : ''}`}>
              <button type="button" onClick={() => setSelectedId(boda.id)} className="flex w-full min-w-0 items-center gap-3 text-left">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl">
                  {boda.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={boda.photo_url} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span aria-hidden>🏍️</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold">{boda.name}</span>
                  <span className="block text-sm">
                    {boda.rating_count > 0 ? <Stars value={Number(boda.rating_avg)} count={boda.rating_count} size="text-sm" /> : <span className="font-semibold text-brand-700">{t('noRating')}</span>}
                  </span>
                  <span className="block text-sm text-muted">{t('away', { distance: fmt.distance(meters) })}</span>
                </span>
              </button>
              <Button loading={requesting === boda.id} disabled={requesting !== null} onClick={() => void request(boda)} className="w-full">
                {t('request')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
