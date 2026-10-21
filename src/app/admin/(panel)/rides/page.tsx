'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loading } from '@/components/app-header';
import { RideStatusBadge } from '@/components/ride-status-badge';
import { Banner, Card, TextInput } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { nairobiDay } from '@/lib/clock';
import { getSupabase } from '@/lib/supabase/client';
import type { Ride, RideItem } from '@/lib/types';

const LIMIT = 500;

export default function AdminRidesPage() {
  const t = useTranslations('admin.rides');
  const tr = useTranslations('ride');
  const ts = useTranslations('shoppingBoda');
  const fmt = useFormat();
  const format = useFormatter();
  const [from, setFrom] = useState(() => nairobiDay(Date.now() - 6 * 86_400_000));
  const [to, setTo] = useState(() => nairobiDay(Date.now()));
  const [onlyCounted, setOnlyCounted] = useState(false);
  const [onlySuspect, setOnlySuspect] = useState(false);
  const [rows, setRows] = useState<Ride[] | null>(null);
  // /admin/rides?ride=<id>: one order opened from an alert (read from the URL on the client; no Suspense needed)
  const [focus, setFocus] = useState<{ ride: Ride | null; items: RideItem[]; missing: boolean } | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('ride');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    void (async () => {
      const supabase = getSupabase();
      const [r, i] = await Promise.all([
        supabase.from('rides').select('*').eq('id', id).maybeSingle(),
        supabase.from('ride_items').select('*').eq('ride_id', id).order('position'),
      ]);
      if (r.error) console.error('[rides] focus ride', { message: r.error.message, code: r.error.code, details: r.error.details, hint: r.error.hint });
      if (i.error) console.error('[rides] focus items', { message: i.error.message, code: i.error.code, details: i.error.details, hint: i.error.hint });
      setFocus({ ride: (r.data as Ride | null) ?? null, items: (i.data ?? []) as RideItem[], missing: !r.error && !r.data });
    })();
  }, []);

  const load = useCallback(async () => {
    let q = getSupabase()
      .from('rides')
      .select('*')
      .gte('requested_at', `${from}T00:00:00+03:00`)
      .lte('requested_at', `${to}T23:59:59.999+03:00`)
      .order('requested_at', { ascending: false })
      .limit(LIMIT);
    if (onlyCounted) q = q.eq('counted', true);
    if (onlySuspect) q = q.eq('suspect', true);
    const { data, error } = await q;
    if (!error) setRows((data ?? []) as Ride[]);
  }, [from, to, onlyCounted, onlySuspect]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const exportHref = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (onlyCounted) p.set('counted', '1');
    if (onlySuspect) p.set('suspect', '1');
    return `/api/admin/export?${p}`;
  }, [from, to, onlyCounted, onlySuspect]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{t('title')}</h2>
        <a href={exportHref} download className="inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-5 font-bold text-white active:bg-brand-700">
          ⬇ {t('exportCsv')}
        </a>
      </div>

      {focus && (
        <Card className="space-y-2 border-2 border-brand-600" data-testid="focus-ride">
          {focus.ride ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">{focus.ride.client_name} → {focus.ride.boda_name}</p>
                <RideStatusBadge status={focus.ride.status} />
              </div>
              <p className="text-sm text-muted">{format.dateTime(new Date(focus.ride.requested_at), { dateStyle: 'short', timeStyle: 'short' })}</p>
              {focus.ride.client_note && <p className="rounded-xl bg-canvas p-3 text-base">“{focus.ride.client_note}”</p>}
              {focus.items.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5">
                  {focus.items.map((it) => <li key={it.id}>{it.quantity} × {it.custom_name ?? it.name_en ?? it.name_sw}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p className="text-muted">{t('rideNotFound')}</p>
          )}
        </Card>
      )}

      <Card className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold">
          {t('from')}
          <TextInput type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          {t('to')}
          <TextInput type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <label className="flex min-h-12 items-center gap-2 self-end text-base font-semibold">
          <input type="checkbox" className="size-5" checked={onlyCounted} onChange={(e) => setOnlyCounted(e.target.checked)} />
          {t('onlyCounted')}
        </label>
        <label className="flex min-h-12 items-center gap-2 self-end text-base font-semibold">
          <input type="checkbox" className="size-5" checked={onlySuspect} onChange={(e) => setOnlySuspect(e.target.checked)} />
          {t('onlySuspect')}
        </label>
      </Card>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Card className="text-center text-muted">{t('noRides')}</Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {t('showing', { count: rows.length })}
            {rows.length >= LIMIT && <Banner kind="warn">{t('limitReached', { count: LIMIT })}</Banner>}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-canvas text-muted">
                <tr>
                  <th className="p-3">{t('when')}</th>
                  <th className="p-3">{t('client')}</th>
                  <th className="p-3">{t('boda')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3">{t('duration')}</th>
                  <th className="p-3">{t('price')}</th>
                  <th className="p-3">{t('flags')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const minutes = r.accepted_at && r.completed_at ? (Date.parse(r.completed_at) - Date.parse(r.accepted_at)) / 60000 : null;
                  return (
                    <tr key={r.id} className="border-t border-line align-top">
                      <td className="whitespace-nowrap p-3">{format.dateTime(new Date(r.requested_at), { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="p-3">
                        {r.type === 'shopping' && <span className="mb-1 inline-block rounded-full bg-accent-400 px-2 py-0.5 text-xs font-extrabold text-[#1a1200]">🛒 {ts('badge')} · {r.items_count}</span>}
                        <div>{r.client_name}</div>
                      </td>
                      <td className="p-3">{r.boda_name}<br /><span className="text-xs text-muted">{r.boda_plate}</span></td>
                      <td className="p-3">
                        <RideStatusBadge status={r.status} />
                        {r.cancelled_by && <span className="ml-1 text-xs text-muted">{tr(`cancelledBy.${r.cancelled_by}`)}</span>}
                      </td>
                      <td className="whitespace-nowrap p-3 tabular-nums">{minutes === null ? '–' : `${minutes.toFixed(1)} min`}</td>
                      <td className="whitespace-nowrap p-3 tabular-nums">{r.type === 'shopping' ? (r.items_total_kes === null ? '–' : `${fmt.ksh(r.items_total_kes)} + ${fmt.ksh(r.delivery_fee_kes ?? 0)}`) : r.agreed_price_kes === null ? '–' : fmt.kes(r.agreed_price_kes)}</td>
                      <td className="space-y-1 p-3">
                        {r.status === 'completed' && (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${r.counted ? 'bg-brand-100 text-brand-900' : 'bg-line text-muted'}`}>
                            {r.counted ? tr('counted') : tr('notCounted')}
                          </span>
                        )}
                        {r.suspect && (
                          <div className="rounded-lg bg-warn-50 px-2 py-1 text-xs font-semibold text-[#7a5a00]">
                            ⚠ {tr('suspect')}: {r.suspect_reason.map((x) => (x === 'too_fast' || x === 'pair_frequency' || x === 'problem_reported' ? tr(`reason.${x}`) : x)).join(', ')}
                          </div>
                        )}
                        {r.auto_confirmed && <div className="text-xs text-muted">{tr('autoConfirmed')}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
