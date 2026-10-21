'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/app-header';
import Link from 'next/link';
import { useAlertCount } from '@/components/admin/alert-count';
import { Card } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { getSupabase } from '@/lib/supabase/client';

interface Windowed { today: number; week: number; month: number; total?: number }
interface Overview {
  counted: Windowed;
  counted_clean: Windowed;
  completed: Windowed;
  suspect: Windowed;
  requests: Windowed;
  awaiting_confirmation: number;
  auto_confirmed_month: number;
  acceptance_30d: { accepted: number; responded: number; avg_accept_seconds: number | null };
  active_bodas: Windowed;
  bodas: { pending: number; approved: number; suspended: number; available_now: number };
}
interface DayRow {
  day: string; requests: number; accepted: number; completed: number;
  counted: number; counted_clean: number; suspect: number; active_bodas: number;
}

const REFRESH_MS = 30_000;

export default function AdminOverviewPage() {
  const t = useTranslations('admin.overview');
  const fmt = useFormat();
  const ta = useTranslations('admin.alerts');
  const { count: alertCount } = useAlertCount();
  const [data, setData] = useState<Overview | null>(null);
  const [series, setSeries] = useState<DayRow[]>([]);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [o, s] = await Promise.all([supabase.rpc('admin_overview'), supabase.rpc('admin_daily_series', { p_days: 14 })]);
    if (!o.error) setData(o.data as Overview);
    if (!s.error) setSeries((s.data ?? []) as DayRow[]);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return <Loading />;

  const acceptance = data.acceptance_30d.responded > 0
    ? Math.round((data.acceptance_30d.accepted / data.acceptance_30d.responded) * 100)
    : null;
  const avgAccept = data.acceptance_30d.avg_accept_seconds;

  return (
    <>
      {alertCount > 0 && (
        <Link href="/admin/alerts" data-testid="alert-banner" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-accent-400 bg-warn-50 px-4 py-3 font-bold text-[#7a5a00] active:opacity-80">
          <span>🔔 {ta('banner', { count: alertCount })}</span>
          <span aria-hidden>→</span>
        </Link>
      )}
      <div>
        <h2 className="text-2xl font-extrabold">{t('question')}</h2>
        <p className="text-sm text-muted">{t('countedHint')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['today', 'week', 'month'] as const).map((w) => (
          <Card key={w} className="bg-brand-600 text-center text-white">
            <p className="text-sm font-semibold opacity-90">{t(w)}</p>
            <p className="text-5xl font-extrabold tabular-nums">{data.counted[w]}</p>
            <p className="mt-1 text-xs opacity-90">{t('clean')}: {data.counted_clean[w]}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('suspect')} value={data.suspect.month} sub={`${t('today')}: ${data.suspect.today}`} tone={data.suspect.month > 0 ? 'warn' : undefined} />
        <Stat label={t('requests')} value={data.requests.month} sub={`${t('today')}: ${data.requests.today}`} />
        <Stat label={t('acceptanceRate')} value={acceptance === null ? '–' : `${acceptance}%`} />
        <Stat label={t('avgAccept')} value={avgAccept === null ? '–' : fmt.countdown(avgAccept)} sub="min:sec" />
        <Stat label={t('activeBodas')} value={data.active_bodas.today} sub={`${t('week')}: ${data.active_bodas.week} · ${t('month')}: ${data.active_bodas.month}`} />
        <Stat label={t('availableNow')} value={data.bodas.available_now} />
        <Stat label={t('awaitingConfirmation')} value={data.awaiting_confirmation} />
        <Stat label={t('autoConfirmed')} value={data.auto_confirmed_month} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('pending')} value={data.bodas.pending} tone={data.bodas.pending > 0 ? 'warn' : undefined} />
        <Stat label={t('approved')} value={data.bodas.approved} />
        <Stat label={t('suspended')} value={data.bodas.suspended} />
      </div>

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('perDay')} · {t('last14')}</h3>
        <DayChart rows={series} />
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('day')}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-1 pr-3">{t('day')}</th>
                  <th className="pr-3">{t('requests')}</th>
                  <th className="pr-3">{t('legendClean')}</th>
                  <th className="pr-3">{t('legendSuspect')}</th>
                  <th>{t('activeBodas')}</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((d) => (
                  <tr key={d.day} className="border-b border-line/60">
                    <td className="py-1 pr-3">{d.day}</td>
                    <td className="pr-3">{d.requests}</td>
                    <td className="pr-3">{d.counted_clean}</td>
                    <td className="pr-3">{d.suspect}</td>
                    <td>{d.active_bodas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'warn' }) {
  return (
    <Card className={tone === 'warn' ? 'border-accent-400 bg-warn-50' : ''}>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Stacked bars: confirmed + clean / confirmed but suspect / finished but not confirmed. */
function DayChart({ rows }: { rows: DayRow[] }) {
  const t = useTranslations('admin.overview');
  const max = Math.max(1, ...rows.map((r) => r.completed));
  if (rows.length === 0) return <p className="text-muted">{t('noData')}</p>;
  return (
    <div>
      <div className="flex h-44 items-end gap-1" role="img" aria-label={t('perDay')}>
        {rows.map((r) => {
          const clean = r.counted_clean;
          const suspectCounted = r.counted - r.counted_clean;
          const unconfirmed = Math.max(0, r.completed - r.counted);
          const h = (n: number) => `${(n / max) * 100}%`;
          return (
            <div key={r.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${r.day}: ${r.counted} / ${r.completed}`}>
              <span className="mb-0.5 text-center text-[11px] font-bold tabular-nums">{r.completed || ''}</span>
              <div style={{ height: h(unconfirmed) }} className="bg-line" />
              <div style={{ height: h(suspectCounted) }} className="bg-accent-500" />
              <div style={{ height: h(clean) }} className="rounded-t-sm bg-brand-600" />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {rows.map((r) => (
          <span key={r.day} className="min-w-0 flex-1 text-center text-[10px] text-muted">{r.day.slice(8)}</span>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li><span className="mr-1 inline-block size-3 rounded-sm bg-brand-600" />{t('legendClean')}</li>
        <li><span className="mr-1 inline-block size-3 rounded-sm bg-accent-500" />{t('legendSuspect')}</li>
        <li><span className="mr-1 inline-block size-3 rounded-sm bg-line" />{t('legendUnconfirmed')}</li>
      </ul>
    </div>
  );
}
