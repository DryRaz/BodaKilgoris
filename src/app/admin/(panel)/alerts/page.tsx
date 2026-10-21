'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/app-header';
import { useAlertCount } from '@/components/admin/alert-count';
import { useToast } from '@/components/toast';
import { Banner, Button, Card } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import {
  ALERT_CATEGORIES, ALERT_STATUSES, CATEGORY_CLASS, logSupabaseError, telHref, whatsappHref,
  type AlertCategory, type AlertRow, type AlertStatus, type ClientAlertGroup,
} from '@/lib/alerts';
import { formatPhone } from '@/lib/phone';
import { getSupabase } from '@/lib/supabase/client';

const selectClass = 'min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 text-base font-semibold';

function CategoryChip({ category }: { category: AlertCategory }) {
  const t = useTranslations('admin.alerts.category');
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${CATEGORY_CLASS[category]}`}>{t(category)}</span>;
}

function ContactButtons({ phone }: { phone: string | null }) {
  const t = useTranslations('admin.alerts');
  if (!phone) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={telHref(phone)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-white font-bold active:opacity-80">📞 {t('call')}</a>
      <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[#1da851] bg-[#e8f8ee] font-bold text-[#0f6b34] active:opacity-80">💬 {t('whatsapp')}</a>
    </div>
  );
}

function AlertItem({ row, open, onToggle, onChanged }: { row: AlertRow; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const t = useTranslations('admin.alerts');
  const tc = useTranslations('admin.alerts.category');
  const format = useFormatter();
  const te = useErrorMessage();
  const toast = useToast();
  const [note, setNote] = useState(row.admin_note ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(status: AlertStatus | null, withNote: boolean) {
    setBusy(status ?? 'note');
    const { error } = await getSupabase().rpc('admin_set_alert', { p_id: row.id, p_status: status, p_note: withNote ? note : null });
    setBusy(null);
    if (error) {
      logSupabaseError('admin_set_alert', error);
      return toast.show(te(error), 'error');
    }
    toast.show(t('saved'), 'success');
    onChanged();
  }

  const when = format.dateTime(new Date(row.created_at), { dateStyle: 'short', timeStyle: 'short' });
  return (
    <li>
      <Card className={`space-y-3 !p-0 ${row.status === 'new' ? 'border-l-8 border-l-accent-400' : ''}`} data-testid="alert-row" data-status={row.status} data-category={row.category}>
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left active:bg-canvas">
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <CategoryChip category={row.category} />
              <span className="text-sm text-muted">{when}</span>
              {row.status !== 'new' && <span className="rounded-full bg-line px-2 py-0.5 text-xs font-bold text-muted">{t(`status.${row.status}`)}</span>}
            </span>
            <span className="block truncate text-base font-bold">{row.matched_text ?? t('textRemoved')}</span>
            <span className="block truncate text-sm text-muted">{row.client_name ?? '–'}</span>
          </span>
          <span aria-hidden className="text-xl text-muted">{open ? '▴' : '▾'}</span>
        </button>

        {open && (
          <div className="space-y-4 border-t border-line p-4">
            <dl className="space-y-2 text-base">
              <div><dt className="text-sm text-muted">{t('typedText')}</dt><dd className="break-words font-bold" data-testid="alert-text">{row.matched_text ?? t('textRemoved')}</dd></div>
              <div><dt className="text-sm text-muted">{t('whereFound')}</dt><dd>{row.source === 'client_note' ? t('inNote') : t('inItem')}</dd></div>
              <div>
                <dt className="text-sm text-muted">{t('client')}</dt>
                <dd className="font-semibold">{row.client_name ?? '–'}{row.client_phone && <span className="ml-2 font-normal text-muted">{formatPhone(row.client_phone)}</span>}</dd>
              </div>
              {row.recent_count >= 2 && (
                <div className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-semibold text-[#7a5a00]">
                  {t('recurrence', { n: row.recent_count, category: tc(row.category) })}
                </div>
              )}
            </dl>

            <ContactButtons phone={row.client_phone} />
            <Link href={`/admin/rides?ride=${row.ride_id}`} className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-brand-600 font-bold text-brand-700 active:opacity-80">
              {t('openOrder')} →
            </Link>

            <label className="block space-y-1 text-sm font-semibold">
              {t('privateNote')}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className="w-full rounded-xl border-2 border-line p-3 text-base font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="secondary" loading={busy === 'seen'} disabled={busy !== null || row.status === 'seen'} onClick={() => void act('seen', true)}>{t('actions.seen')}</Button>
              <Button loading={busy === 'handled'} disabled={busy !== null} onClick={() => void act('handled', true)}>{t('actions.handled')}</Button>
              <Button variant="secondary" loading={busy === 'dismissed'} disabled={busy !== null} onClick={() => void act('dismissed', true)}>{t('actions.dismissed')}</Button>
              <Button variant="ghost" loading={busy === 'note'} disabled={busy !== null || note === (row.admin_note ?? '')} onClick={() => void act(null, true)}>{t('actions.saveNote')}</Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

export default function AdminAlertsPage() {
  const t = useTranslations('admin.alerts');
  const tc = useTranslations('admin.alerts.category');
  const format = useFormatter();
  const { refresh: refreshBadge } = useAlertCount();
  const [view, setView] = useState<'list' | 'clients'>('list');
  const [status, setStatus] = useState<string>('open');
  const [category, setCategory] = useState<string>('');
  const [rows, setRows] = useState<AlertRow[] | null>(null);
  const [groups, setGroups] = useState<ClientAlertGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (view === 'list') {
      // "open" = new + seen: what still needs the admin's eyes
      const { data, error } = await supabase.rpc('admin_alerts_list', {
        p_status: status === 'open' || status === 'all' ? null : status, p_category: category || null, p_limit: 200,
      });
      if (error) {
        logSupabaseError('admin_alerts_list', error);
        setFailed(true);
        return;
      }
      setFailed(false);
      const all = (data ?? []) as AlertRow[];
      setRows(status === 'open' ? all.filter((r) => r.status === 'new' || r.status === 'seen') : all);
    } else {
      const { data, error } = await supabase.rpc('admin_alerts_by_client', { p_days: 90 });
      if (error) {
        logSupabaseError('admin_alerts_by_client', error);
        setFailed(true);
        return;
      }
      setFailed(false);
      setGroups((data ?? []) as ClientAlertGroup[]);
    }
  }, [view, status, category]);

  useEffect(() => {
    if (view === 'list') setRows(null);
    else setGroups(null);
    void load();
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), 15_000);
    return () => clearInterval(id);
  }, [load, view]);

  const changed = useCallback(() => {
    void load();
    void refreshBadge();
  }, [load, refreshBadge]);

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">{t('title')}</h2>
        <p className="text-sm text-muted">{t('intro')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(['list', 'clients'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`min-h-12 rounded-2xl border-2 font-bold ${view === v ? 'border-brand-600 bg-brand-100 text-brand-900' : 'border-line bg-white text-muted'}`}>
            {t(`view.${v}`)}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm font-semibold">
            {t('filterStatus')}
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} data-testid="filter-status">
              <option value="open">{t('statusOpen')}</option>
              <option value="all">{t('statusAll')}</option>
              {ALERT_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            {t('filterCategory')}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} data-testid="filter-category">
              <option value="">{t('categoryAll')}</option>
              {ALERT_CATEGORIES.map((c) => <option key={c} value={c}>{tc(c)}</option>)}
            </select>
          </label>
        </div>
      )}

      {failed && <Banner kind="error">{t('loadFailed')}</Banner>}

      {view === 'list' ? (
        rows === null ? (failed ? null : <Loading />) : rows.length === 0 ? (
          <Card className="text-center text-muted">{t('empty')}</Card>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <AlertItem key={`${r.id}:${r.status}:${r.admin_note ?? ''}`} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onChanged={changed} />
            ))}
          </ul>
        )
      ) : groups === null ? (failed ? null : <Loading />) : groups.length === 0 ? (
        <Card className="text-center text-muted">{t('empty')}</Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.client_id}>
              <Card className="space-y-3" data-testid="alert-group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">{g.client_name ?? '–'}</p>
                    {g.client_phone && <p className="text-sm text-muted">{formatPhone(g.client_phone)}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-extrabold tabular-nums">{g.total}</p>
                    {g.new_count > 0 && <p className="text-xs font-bold text-danger">{t('newCount', { count: g.new_count })}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALERT_CATEGORIES.filter((c) => g.by_category?.[c]).map((c) => (
                    <span key={c} className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${CATEGORY_CLASS[c]}`}>{tc(c)} · {g.by_category?.[c]}</span>
                  ))}
                </div>
                <p className="text-xs text-muted">{t('lastAlert', { when: format.dateTime(new Date(g.last_at), { dateStyle: 'short', timeStyle: 'short' }) })}</p>
                <ContactButtons phone={g.client_phone} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
