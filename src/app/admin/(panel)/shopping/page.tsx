'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/app-header';
import { Banner, Card } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useLocaleContext } from '@/i18n/provider';
import { formatPhone } from '@/lib/phone';
import { getSupabase } from '@/lib/supabase/client';
import type { ItemStatus, ProblemType } from '@/lib/types';

interface Windowed { today?: number; week: number; month: number; total: number }
interface Overview {
  requests: Windowed; counted: Windowed; completed: Windowed;
  suspect: { week: number; month: number; total: number };
  awaiting_confirmation: number;
  avg_order_kes: number | null; avg_delivery_fee_kes: number | null;
  problems: { reported: number; completed: number; rate_pct: number | null };
  receipts: { kept_pct: number | null; shown_pct: number | null };
  no_receipt_items_pct: number | null;
  problem_types: Partial<Record<ProblemType, number>>;
  top_items: { name_en: string; name_sw: string; orders: number; quantity: number; unit: string | null }[];
  top_custom: { name: string; n: number }[];
}
interface BodaRow {
  id: string; name: string; plate: string; shopping_orders: number; shopping_counted: number; shopping_suspect: number;
  receipts_kept_pct: number | null; receipts_shown_pct: number | null; no_receipt_pct: number | null;
  avg_order_kes: number | null; avg_delivery_fee_kes: number | null;
}
interface Problem {
  id: string; requested_at: string; problem_at: string; problem_type: ProblemType; problem_text: string | null;
  client_name: string; client_phone: string | null; boda_name: string; boda_plate: string;
  budget_max_kes: number | null; items_total_kes: number | null; delivery_fee_kes: number | null;
  receipts_kept: boolean; receipts_shown: boolean; client_confirmed: boolean; client_note: string | null; delivery_landmark: string | null;
  items: { name_en: string | null; name_sw: string | null; custom_name: string | null; quantity: number; unit: string | null; status: ItemStatus; replacement_text: string | null; no_receipt: boolean }[];
}

const REFRESH_MS = 30_000;
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v}%`);

export default function AdminShoppingPage() {
  const t = useTranslations('admin.shopping');
  const ts = useTranslations('shopping');
  const fmt = useFormat();
  const format = useFormatter();
  const { locale } = useLocaleContext();
  const [data, setData] = useState<Overview | null>(null);
  const [bodas, setBodas] = useState<BodaRow[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [o, b, p] = await Promise.all([supabase.rpc('admin_shopping_overview'), supabase.rpc('admin_boda_stats'), supabase.rpc('admin_shopping_problems')]);
    if (!o.error) setData(o.data as Overview);
    if (!b.error) setBodas(((b.data ?? []) as BodaRow[]).filter((x) => x.shopping_orders > 0));
    if (!p.error) setProblems((p.data ?? []) as Problem[]);
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return <Loading />;
  const name = (i: { name_en: string | null; name_sw: string | null; custom_name?: string | null }) =>
    i.custom_name || (locale === 'sw' ? i.name_sw : i.name_en) || i.name_en || '';

  return (
    <>
      <div>
        <h2 className="text-2xl font-extrabold">{t('title')}</h2>
        <p className="text-sm text-muted">{t('hint')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['today', 'week', 'month'] as const).map((w) => (
          <Card key={w} className="bg-brand-600 text-center text-white">
            <p className="text-sm font-semibold opacity-90">{t(w)}</p>
            <p className="text-5xl font-extrabold tabular-nums">{data.counted[w] ?? 0}</p>
            <p className="mt-1 text-xs opacity-90">{t('requests')}: {data.requests[w] ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('avgOrder')} value={data.avg_order_kes === null ? '–' : fmt.ksh(data.avg_order_kes)} />
        <Stat label={t('avgFee')} value={data.avg_delivery_fee_kes === null ? '–' : fmt.ksh(data.avg_delivery_fee_kes)} />
        <Stat label={t('problemRate')} value={pct(data.problems.rate_pct)} sub={`${data.problems.reported} / ${data.problems.completed}`} tone={data.problems.reported > 0 ? 'warn' : undefined} />
        <Stat label={t('suspect')} value={data.suspect.month} sub={`${t('total')}: ${data.suspect.total}`} tone={data.suspect.month > 0 ? 'warn' : undefined} />
        <Stat label={t('receiptsKept')} value={pct(data.receipts.kept_pct)} />
        <Stat label={t('receiptsShown')} value={pct(data.receipts.shown_pct)} />
        <Stat label={t('noReceiptItems')} value={pct(data.no_receipt_items_pct)} />
        <Stat label={t('awaiting')} value={data.awaiting_confirmation} />
      </div>

      <Card className="space-y-2">
        <h3 className="text-lg font-extrabold">{t('problemsByReason')}</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(['receipts_not_shown', 'total_mismatch', 'missing_item', 'other'] as const).map((p) => (
            <li key={p} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2" data-testid={`problem-count-${p}`}>
              <span>{ts(`problems.${p}`)}</span><span className="text-xl font-extrabold tabular-nums">{data.problem_types[p] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-lg font-extrabold">{t('topItems')}</h3>
          {data.top_items.length === 0 ? <p className="text-muted">{t('noData')}</p> : (
            <ol className="space-y-1">
              {data.top_items.map((i) => (
                <li key={i.name_en} className="flex justify-between gap-2 text-base"><span>{name(i)}</span><span className="font-bold tabular-nums">{i.orders}×</span></li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="space-y-2">
          <h3 className="text-lg font-extrabold">{t('topCustom')}</h3>
          <p className="text-xs text-muted">{t('topCustomHint')}</p>
          {data.top_custom.length === 0 ? <p className="text-muted">{t('noData')}</p> : (
            <ol className="space-y-1" data-testid="top-custom">
              {data.top_custom.map((i) => (
                <li key={i.name} className="flex justify-between gap-2 text-base"><span className="break-words">{i.name}</span><span className="font-bold tabular-nums">{i.n}×</span></li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="space-y-2">
        <h3 className="text-lg font-extrabold">{t('perBoda')}</h3>
        {bodas.length === 0 ? <p className="text-muted">{t('noData')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
              <thead className="text-muted">
                <tr><th className="py-1 pr-3">{t('boda')}</th><th className="pr-3">{t('orders')}</th><th className="pr-3">{t('counted')}</th><th className="pr-3">{t('receiptsKeptShort')}</th><th className="pr-3">{t('receiptsShownShort')}</th><th className="pr-3">{t('noReceiptShort')}</th><th className="pr-3">{t('avgOrder')}</th><th>{t('avgFee')}</th></tr>
              </thead>
              <tbody>
                {bodas.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-1 pr-3 font-semibold">{b.name}<br /><span className="text-xs font-normal text-muted">{b.plate}</span></td>
                    <td className="pr-3">{b.shopping_orders}</td><td className="pr-3">{b.shopping_counted}</td>
                    <td className="pr-3">{pct(b.receipts_kept_pct)}</td><td className="pr-3">{pct(b.receipts_shown_pct)}</td><td className="pr-3">{pct(b.no_receipt_pct)}</td>
                    <td className="pr-3">{b.avg_order_kes === null ? '–' : fmt.ksh(b.avg_order_kes)}</td><td>{b.avg_delivery_fee_kes === null ? '–' : fmt.ksh(b.avg_delivery_fee_kes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="space-y-3" aria-label={t('problemsTitle')}>
        <h3 className="text-xl font-extrabold">⚠️ {t('problemsTitle')} ({problems.length})</h3>
        {problems.length === 0 && <Card className="text-center text-muted">{t('noProblems')}</Card>}
        {problems.map((p) => (
          <Card key={p.id} className="space-y-2 border-danger/40" data-testid="problem-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-danger-50 px-3 py-1 text-sm font-extrabold text-danger" data-testid="problem-type">{ts(`problems.${p.problem_type}`)}</span>
              <span className="text-xs text-muted">{format.dateTime(new Date(p.problem_at), { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            {p.problem_text && <p className="rounded-xl bg-canvas px-3 py-2 text-base">“{p.problem_text}”</p>}
            <p className="text-sm">
              <b>{p.client_name}</b>{p.client_phone && <> · <a className="underline" href={`tel:${p.client_phone}`}>{formatPhone(p.client_phone)}</a></>} → <b>{p.boda_name}</b> ({p.boda_plate})
            </p>
            <p className="text-sm text-muted">
              {t('itemsTotal')}: {p.items_total_kes === null ? '–' : fmt.ksh(p.items_total_kes)} · {t('fee')}: {p.delivery_fee_kes === null ? '–' : fmt.ksh(p.delivery_fee_kes)}
              {p.budget_max_kes !== null && ` · ${t('budget')}: ${fmt.ksh(p.budget_max_kes)}`} · 🧾 {t('kept')}: {p.receipts_kept ? '✓' : '✗'} · {t('shown')}: {p.receipts_shown ? '✓' : '✗'}
            </p>
            {(p.client_note || p.delivery_landmark) && <p className="text-sm text-muted">{[p.delivery_landmark, p.client_note].filter(Boolean).join(' · ')}</p>}
            <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
              {p.items.map((i, idx) => (
                <li key={idx} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                  <span>{i.quantity}{i.unit ? ` ${ts(`units.${i.unit}` as never)}` : ''} · {name(i)}{i.status === 'replaced' && i.replacement_text ? ` ↔ ${i.replacement_text}` : ''}</span>
                  <span className="text-muted">{ts(`itemStatus.${i.status}`)}{i.no_receipt ? ` · 🧾 ${ts('noReceipt')}` : ''}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
      <Banner kind="info">{t('footer')}</Banner>
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
