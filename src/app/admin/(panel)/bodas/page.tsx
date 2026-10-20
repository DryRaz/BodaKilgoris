'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loading } from '@/components/app-header';
import { useToast } from '@/components/toast';
import { Button, Card, Stars, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { postApi } from '@/lib/api';
import { formatPhone, isValidPin } from '@/lib/phone';
import { getSupabase } from '@/lib/supabase/client';
import type { BodaStatus } from '@/lib/types';
import { useFormatter } from 'next-intl';

interface BodaRow {
  id: string; name: string; phone: string; plate: string; photo_url: string | null;
  status: BodaStatus; is_available: boolean; rating_avg: number; rating_count: number;
  requests: number; responded: number; accepted: number; counted: number; suspect: number;
  avg_accept_seconds: number | null; last_online_at: string | null;
  shopping_orders: number; shopping_counted: number; shopping_suspect: number;
  receipts_kept_pct: number | null; receipts_shown_pct: number | null; no_receipt_pct: number | null;
  avg_order_kes: number | null; avg_delivery_fee_kes: number | null;
}

const FILTERS: Array<'all' | BodaStatus> = ['all', 'pending', 'approved', 'suspended'];
const STATUS_STYLE: Record<BodaStatus, string> = {
  pending: 'bg-warn-50 text-[#7a5a00]',
  approved: 'bg-brand-100 text-brand-900',
  suspended: 'bg-danger-50 text-danger',
};

export default function AdminBodasPage() {
  const t = useTranslations('admin.bodas');
  const ts = useTranslations('admin.shopping');
  const tc = useTranslations('common');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const format = useFormatter();
  const [rows, setRows] = useState<BodaRow[] | null>(null);
  const [filter, setFilter] = useState<'all' | BodaStatus>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().rpc('admin_boda_stats');
    if (!error) setRows((data ?? []) as BodaRow[]);
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!q || r.name.toLowerCase().includes(q) || r.phone.includes(q.replace(/\s/g, '')) || r.plate.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  async function setStatus(id: string, status: BodaStatus) {
    setBusyId(id);
    const { error } = await getSupabase().rpc('admin_set_boda_status', { p_boda_id: id, p_status: status });
    if (error) toast.show(te(error), 'error');
    else toast.show(t('statusChanged'), 'success');
    setBusyId(null);
    void load();
  }

  async function resetPin(row: BodaRow) {
    const pin = window.prompt(t('resetPinPrompt', { name: row.name }));
    if (pin === null) return;
    if (!isValidPin(pin.trim())) return toast.show(te('invalid_pin'), 'error');
    setBusyId(row.id);
    try {
      await postApi('/api/admin/boda/reset-pin', { bodaId: row.id, pin: pin.trim() });
      toast.show(t('pinReset'), 'success');
    } catch (e) {
      toast.show(te(e), 'error');
    }
    setBusyId(null);
  }

  if (!rows) return <Loading />;

  return (
    <>
      <h2 className="text-2xl font-extrabold">{t('title')} ({rows.length})</h2>

      <div className="flex flex-wrap gap-2" role="group">
        {FILTERS.map((f) => {
          const n = f === 'all' ? rows.length : rows.filter((r) => r.status === f).length;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold ${filter === f ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}
            >
              {f === 'all' ? t('filterAll') : t(`status_${f}`)} ({n})
            </button>
          );
        })}
      </div>
      <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} type="search" />

      {visible.length === 0 && <Card className="text-center text-muted">{t('noBodas')}</Card>}

      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((r) => {
          const rate = r.responded > 0 ? Math.round((r.accepted / r.responded) * 100) : null;
          return (
            <li key={r.id}>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-3xl">
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photo_url} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span aria-hidden>🏍️</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-extrabold">{r.name}</p>
                    <p className="text-sm text-muted">
                      <a href={`tel:${r.phone}`} className="underline">{formatPhone(r.phone)}</a> · {r.plate}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${STATUS_STYLE[r.status]}`}>
                      {t(`status_${r.status}`)}{r.is_available ? ' · 🟢' : ''}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-4 gap-2 text-center text-sm">
                  <Metric label={t('requests')} value={r.requests} />
                  <Metric label={t('acceptance')} value={rate === null ? '–' : `${rate}%`} />
                  <Metric label={t('counted')} value={r.counted} />
                  <Metric label={t('suspect')} value={r.suspect} warn={r.suspect > 0} />
                </dl>
                {r.shopping_orders > 0 && (
                  <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-muted" data-testid="boda-shopping-line">
                    🛒 {ts('line', { orders: r.shopping_orders, counted: r.shopping_counted })} · 🧾 {ts('receiptsLine', { kept: r.receipts_kept_pct ?? '–', shown: r.receipts_shown_pct ?? '–', none: r.no_receipt_pct ?? '–' })}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>{r.rating_count > 0 ? <Stars value={Number(r.rating_avg)} count={r.rating_count} size="text-sm" /> : '–'}</span>
                  <span>
                    {t('lastOnline')}: {r.last_online_at ? format.relativeTime(new Date(r.last_online_at)) : t('never')}
                    {r.avg_accept_seconds !== null && ` · ⏱ ${fmt.countdown(r.avg_accept_seconds)}`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {r.status === 'pending' && <Button loading={busyId === r.id} onClick={() => void setStatus(r.id, 'approved')}>{t('approve')}</Button>}
                  {r.status === 'approved' && <Button variant="danger" loading={busyId === r.id} onClick={() => void setStatus(r.id, 'suspended')}>{t('suspend')}</Button>}
                  {r.status === 'suspended' && <Button loading={busyId === r.id} onClick={() => void setStatus(r.id, 'approved')}>{t('reactivate')}</Button>}
                  {r.status === 'pending' && <Button variant="danger" disabled={busyId === r.id} onClick={() => void setStatus(r.id, 'suspended')}>{t('suspend')}</Button>}
                  <Button variant="secondary" disabled={busyId === r.id} onClick={() => void resetPin(r)}>{t('resetPin')}</Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="sr-only">{tc('appName')}</p>
    </>
  );
}

function Metric({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`rounded-xl px-1 py-2 ${warn ? 'bg-warn-50' : 'bg-canvas'}`}>
      <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
    </div>
  );
}
