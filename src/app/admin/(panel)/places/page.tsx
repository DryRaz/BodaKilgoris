'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loading } from '@/components/app-header';
import { Map } from '@/components/map/Map';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { KILGORIS_CENTER } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase/client';
import type { Place } from '@/lib/types';

/** Plain decimal numbers only ("-1.0035"): a comma is the separator of a pasted "lat, lng" pair, not a decimal mark. */
const toNumber = (s: string): number | null => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * Frequent places: the shortcut chips clients see under the destination field.
 * The list starts EMPTY on purpose; the admin adds the real places of Kilgoris here.
 * "Remove" = deactivate (the place disappears for clients, rides already made keep their text).
 */
export default function AdminPlacesPage() {
  const t = useTranslations('admin.places');
  const te = useErrorMessage();
  const toast = useToast();
  const [rows, setRows] = useState<Place[] | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('places').select('id, name, lat, lng, active').order('name');
    if (error) toast.show(te(error), 'error');
    else setRows((data ?? []) as Place[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setEditing(null);
    setName('');
    setLat('');
    setLng('');
  }

  function edit(p: Place) {
    setEditing(p);
    setName(p.name);
    setLat(String(p.lat));
    setLng(String(p.lng));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // "-1.0035, 34.8767" pasted from a maps app into either field fills both
  function onCoordsInput(value: string, which: 'lat' | 'lng') {
    const pair = value.split(',').map((x) => x.trim());
    if (pair.length === 2 && toNumber(pair[0]) !== null && toNumber(pair[1]) !== null) {
      setLat(pair[0]);
      setLng(pair[1]);
    } else if (which === 'lat') setLat(value);
    else setLng(value);
  }

  const point = useMemo(() => {
    const a = toNumber(lat);
    const b = toNumber(lng);
    return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
  }, [lat, lng]);

  async function save(p: { id: string | null; name: string; lat: number; lng: number; active: boolean }, key: string) {
    setBusy(key);
    const { error } = await getSupabase().rpc('admin_save_place', {
      p_id: p.id, p_name: p.name, p_lat: p.lat, p_lng: p.lng, p_active: p.active,
    });
    setBusy(null);
    if (error) return toast.show(te(error), 'error');
    toast.show(t('saved'), 'success');
    await load();
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!point || !name.trim()) return toast.show(te('invalid_place'), 'error');
    const ok = await save({ id: editing?.id ?? null, name: name.trim(), ...point, active: editing?.active ?? true }, 'form');
    if (ok) reset();
  }

  if (!rows) return <Loading />;

  return (
    <>
      <h2 className="text-2xl font-extrabold">{t('title')} ({rows.filter((r) => r.active).length})</h2>
      <Banner kind="info">{t('intro')}</Banner>

      <Card className="space-y-4">
        <h3 className="text-lg font-extrabold">{editing ? t('editTitle') : t('addTitle')}</h3>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('name')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('namePlaceholder')} autoComplete="off" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('lat')}>
              {(id) => <TextInput id={id} value={lat} onChange={(e) => onCoordsInput(e.target.value, 'lat')} inputMode="decimal" placeholder="-1.0035" autoComplete="off" />}
            </Field>
            <Field label={t('lng')}>
              {(id) => <TextInput id={id} value={lng} onChange={(e) => onCoordsInput(e.target.value, 'lng')} inputMode="decimal" placeholder="34.8767" autoComplete="off" />}
            </Field>
          </div>
          <p className="text-sm text-muted">{t('coordsHint')}</p>
          <Map
            className="h-64 w-full"
            markers={point ? [{ id: 'place', ...point, kind: 'destination' }] : []}
            view={{ center: point ?? KILGORIS_CENTER, zoom: 16, key: editing?.id ?? 'new' }}
            fitKey={point ? `${point.lat}:${point.lng}` : undefined}
            onTap={(p) => {
              setLat(p.lat.toFixed(6));
              setLng(p.lng.toFixed(6));
            }}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={busy === 'form'} disabled={!name.trim() || !point}>{editing ? t('saveChanges') : t('add')}</Button>
            {editing && <Button variant="secondary" onClick={reset}>{t('cancelEdit')}</Button>}
          </div>
        </form>
      </Card>

      {rows.length === 0 && <Card className="text-center text-muted">{t('empty')}</Card>}

      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <li key={p.id}>
            <Card className={`space-y-3 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold">{p.name}</p>
                  <p className="text-sm tabular-nums text-muted">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-bold ${p.active ? 'bg-brand-100 text-brand-900' : 'bg-line text-muted'}`}>
                  {p.active ? t('active') : t('inactive')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => edit(p)}>{t('edit')}</Button>
                <Button
                  variant={p.active ? 'danger' : 'primary'}
                  loading={busy === p.id}
                  onClick={() => void save({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, active: !p.active }, p.id)}
                >
                  {p.active ? t('deactivate') : t('activate')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
