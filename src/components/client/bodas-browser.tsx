'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map } from '@/components/map/Map';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, Stars, TextInput } from '@/components/ui';
import { useAvailableBodas } from '@/hooks/useAvailableBodas';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { usePlaces } from '@/hooks/usePlaces';
import { KILGORIS_CENTER } from '@/lib/constants';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { GeoError, getPosition } from '@/lib/geolocation';
import { getSupabase } from '@/lib/supabase/client';
import type { AvailableBoda, Place } from '@/lib/types';

type Pickup = LatLng & { source: 'gps' | 'pin' };
/** Where the client is going. Entirely optional: text, a pin, a frequent place, any mix, or nothing. */
type DestPoint = LatLng & { source: 'place' | 'pin'; placeName?: string };
type GpsIssue = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'imprecise';

/** A GPS fix worse than this is shown to the client as "check your pin" (the Boda must find them). */
const GPS_IMPRECISE_METERS = 100;

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
  const places = usePlaces();
  const [pickupNote, setPickupNote] = useState('');
  const [destination, setDestination] = useState('');
  const [destPoint, setDestPoint] = useState<DestPoint | null>(null);
  const [placing, setPlacing] = useState(false); // the next tap on the map sets the destination
  const [gpsIssue, setGpsIssue] = useState<GpsIssue | null>(null);
  const [gpsMeters, setGpsMeters] = useState(0);
  const mapBox = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const autoLocated = useRef(false);

  const locate = useCallback(
    async (userInitiated: boolean) => {
      if (!(await requestConsent())) {
        setGpsIssue('denied'); // fallback: the pin on the map
        if (userInitiated) toast.show(tg('denied'), 'error');
        return;
      }
      setLocating(true);
      try {
        const fix = await getPosition();
        setPickup({ lat: fix.lat, lng: fix.lng, source: 'gps' });
        setViewKey(`gps-${Date.now()}`);
        // a vague fix still gives a starting pin, but the client is asked to check / move it
        setGpsMeters(Math.round(fix.accuracy));
        setGpsIssue(fix.accuracy > GPS_IMPRECISE_METERS ? 'imprecise' : null);
      } catch (e) {
        const code = e instanceof GeoError ? e.code : 'unavailable';
        setGpsIssue(code);
        if (userInitiated || code === 'denied') {
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
      ...(destPoint ? [{ id: 'destination', lat: destPoint.lat, lng: destPoint.lng, kind: 'destination' as const }] : []),
    ],
    [list, pickup, destPoint, selectedId],
  );

  async function request(b: AvailableBoda) {
    if (!pickup) {
      toast.show(t('tapMap'), 'info');
      return;
    }
    setRequesting(b.id);
    // Only the pick-up point is required. Everything about the destination may be empty.
    const { error } = await getSupabase().rpc('request_ride', {
      p_boda_id: b.id, p_lat: pickup.lat, p_lng: pickup.lng,
      p_destination: destination.trim() || null,
      p_dest_lat: destPoint?.lat ?? null, p_dest_lng: destPoint?.lng ?? null,
      p_pickup_note: pickupNote.trim() || null,
    });
    if (error) {
      toast.show(te(error), 'error');
      void reload();
    } else {
      onRequested();
    }
    setRequesting(null);
  }

  function pickPlace(place: Place) {
    setDestination(place.name);
    setDestPoint({ lat: place.lat, lng: place.lng, source: 'place', placeName: place.name });
    setPlacing(false);
  }

  function startPlacing() {
    setPlacing(true);
    mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <div className="space-y-2">
        <div ref={mapBox} className={placing ? 'rounded-2xl ring-4 ring-brand-500' : ''}>
          <Map
            className="h-[44dvh] min-h-64 w-full"
            markers={markers}
            view={{ center: origin, zoom: 15, key: viewKey }}
            fitKey={`${list.length}:${pickup ? 1 : 0}`}
            onTap={(p) => {
              if (placing) {
                setDestPoint({ ...p, source: 'pin' });
                setPlacing(false);
                return;
              }
              setPickup({ ...p, source: 'pin' });
              setGpsIssue(null);
              setSelectedId(null);
            }}
            onMarkerClick={(id) => id !== 'pickup' && id !== 'destination' && setSelectedId(id)}
          />
        </div>
        {placing && (
          <Banner kind="info">
            <div className="flex items-center justify-between gap-3">
              <span>🏁 {t('placingHint')}</span>
              <Button variant="ghost" onClick={() => setPlacing(false)} className="shrink-0">{t('cancelPlacing')}</Button>
            </div>
          </Banner>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {pickup ? `📍 ${pickup.source === 'gps' ? t('pickupGps') : t('pickupPin')}` : t('tapMap')}
          </p>
          <Button variant="secondary" loading={locating} onClick={() => void locate(true)} className="shrink-0">
            {locating ? t('locating') : t('useMyLocation')}
          </Button>
        </div>
      </div>

      {gpsIssue && pickup?.source !== 'pin' && (
        <Banner kind="warn">{gpsIssue === 'imprecise' ? t('gpsImprecise', { meters: gpsMeters }) : t('gpsFallback')}</Banner>
      )}

      <Field label={t('pickupNoteLabel')} hint={t('pickupNoteHint')}>
        {(id) => (
          <TextInput
            id={id}
            value={pickupNote}
            onChange={(e) => setPickupNote(e.target.value)}
            placeholder={t('pickupNotePlaceholder')}
            maxLength={200}
            autoComplete="off"
          />
        )}
      </Field>

      {/* Destination: free text, quick places, optional pin. Nothing here ever blocks a request. */}
      <div className="space-y-2">
        <Field label={t('destinationLabel')} hint={t('destinationHint')}>
          {(id) => (
            <TextInput
              id={id}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                // typing over a quick place means the saved coordinates no longer describe the text
                if (destPoint?.source === 'place' && e.target.value.trim() !== destPoint.placeName) setDestPoint(null);
              }}
              placeholder={t('destinationPlaceholder')}
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Field>

        {places.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-muted">{t('placesLabel')}</p>
            <ul className="flex flex-wrap gap-2">
              {places.map((p) => {
                const on = destPoint?.source === 'place' && destPoint.placeName === p.name;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickPlace(p)}
                      className={`min-h-10 rounded-full border-2 px-4 text-base font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink active:bg-brand-50'}`}
                    >
                      {p.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {destPoint ? (
            <>
              <p className="min-w-0 text-sm font-semibold text-brand-700">🏁 {t('destinationPinned')}</p>
              <Button variant="ghost" onClick={() => setDestPoint(null)} className="shrink-0">{t('removePin')}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={startPlacing} disabled={placing}>🏁 {t('placeOnMap')}</Button>
          )}
        </div>
      </div>

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
