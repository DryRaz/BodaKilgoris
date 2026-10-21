'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/app-header';
import { useAlertCount } from '@/components/admin/alert-count';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import {
  ALERT_CATEGORIES, CATEGORY_CLASS, logSupabaseError,
  type AlertCategory, type AlertSettings, type AlertTerm, type AlertTestResult,
} from '@/lib/alerts';
import { getSupabase } from '@/lib/supabase/client';

function Switch({ checked, onChange, label, disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-[#b8b8b8]'}`}
    >
      <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

/**
 * Admin settings: everything about the private "sensitive term" alerts.
 * Alerts never block an order; these switches only decide what the admin gets told about.
 */
export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('admin.alerts.category');
  const te = useErrorMessage();
  const toast = useToast();
  const { refresh: refreshBadge } = useAlertCount();
  const [s, setS] = useState<AlertSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newCat, setNewCat] = useState<AlertCategory>('alcohol');
  const [newOn, setNewOn] = useState(true);
  const [testText, setTestText] = useState('');
  const [test, setTest] = useState<AlertTestResult | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().rpc('admin_alert_settings');
    if (error) {
      logSupabaseError('admin_alert_settings', error);
      setFailed(true);
      return;
    }
    setFailed(false);
    const v = data as AlertSettings;
    setS(v);
    setDays(String(v.retention_days));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function setSetting(key: string, value: number) {
    setBusy(key);
    const { error } = await getSupabase().rpc('admin_set_setting', { p_key: key, p_value: value });
    setBusy(null);
    if (error) {
      logSupabaseError(`admin_set_setting ${key}`, error);
      return toast.show(te(error), 'error');
    }
    toast.show(t('saved'), 'success');
    await load();
    return undefined;
  }

  async function saveTerm(term: AlertTerm, patch: Partial<AlertTerm>, key: string) {
    setBusy(key);
    const next = { ...term, ...patch };
    const { error } = await getSupabase().rpc('admin_save_term', {
      p_id: term.id, p_term: next.term, p_category: next.category, p_alert_enabled: next.alert_enabled, p_active: next.active,
    });
    setBusy(null);
    if (error) {
      logSupabaseError('admin_save_term', error);
      return toast.show(te(error), 'error');
    }
    await load();
    return undefined;
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setBusy('add');
    const { error } = await getSupabase().rpc('admin_save_term', { p_id: null, p_term: newTerm, p_category: newCat, p_alert_enabled: newOn, p_active: true });
    setBusy(null);
    if (error) {
      logSupabaseError('admin_save_term (add)', error);
      return toast.show(te(error), 'error');
    }
    setNewTerm('');
    toast.show(t('termAdded'), 'success');
    await load();
    return undefined;
  }

  async function runTest(e: React.FormEvent) {
    e.preventDefault();
    setBusy('test');
    const { data, error } = await getSupabase().rpc('admin_test_text', { p_text: testText });
    setBusy(null);
    if (error) {
      logSupabaseError('admin_test_text', error);
      return toast.show(te(error), 'error');
    }
    setTest(data as AlertTestResult);
    return undefined;
  }

  if (failed) return <Banner kind="error">{t('loadFailed')}</Banner>;
  if (!s) return <Loading />;
  const master = s.alerts_enabled !== 0;

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-extrabold">{t('title')}</h2>
        <p className="text-sm text-muted">{t('intro')}</p>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold">{t('master')}</h3>
            <p className="text-sm text-muted">{master ? t('masterOn') : t('masterOff')}</p>
          </div>
          <Switch checked={master} label={t('master')} disabled={busy === 'alerts_enabled'} testId="sw-master" onChange={(v) => void setSetting('alerts_enabled', v ? 1 : 0).then(refreshBadge)} />
        </div>
        <ul className="divide-y divide-line">
          {ALERT_CATEGORIES.map((c) => (
            <li key={c} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${CATEGORY_CLASS[c]}`}>{tc(c)}</span>
                <p className="mt-1 text-xs text-muted">{t('last30', { count: s.daily_counts[c] ?? 0 })}</p>
              </div>
              <Switch checked={s.categories[c] !== 0} label={tc(c)} disabled={!master || busy === `alerts_category_${c}`} testId={`sw-cat-${c}`} onChange={(v) => void setSetting(`alerts_category_${c}`, v ? 1 : 0)} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('testTitle')}</h3>
        <form onSubmit={runTest} className="space-y-3">
          <Field label={t('testLabel')}>
            {(id) => <TextInput id={id} value={testText} onChange={(e) => { setTestText(e.target.value); setTest(null); }} maxLength={200} placeholder={t('testPlaceholder')} autoComplete="off" />}
          </Field>
          <Button type="submit" variant="secondary" loading={busy === 'test'} disabled={!testText.trim()}>{t('testButton')}</Button>
        </form>
        {test && (
          <div data-testid="test-result" className="space-y-2">
            <Banner kind={test.would_alert ? 'warn' : 'success'}>{test.would_alert ? t('testWould') : test.matches.length ? t('testMatchOff') : t('testNone')}</Banner>
            {test.matches.length > 0 && (
              <ul className="space-y-1 text-sm">
                {test.matches.map((m) => (
                  <li key={m.term} className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{m.term}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${CATEGORY_CLASS[m.category]}`}>{tc(m.category)}</span>
                    <span className="text-muted">{m.would_alert ? t('wouldAlert') : !test.alerts_enabled ? t('reasonMaster') : !m.category_alert ? t('reasonCategory') : !m.term_alert ? t('reasonTerm') : t('reasonInactive')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('addTitle')}</h3>
        <form onSubmit={addTerm} className="space-y-3">
          <Field label={t('termLabel')}>
            {(id) => <TextInput id={id} value={newTerm} onChange={(e) => setNewTerm(e.target.value)} maxLength={60} autoComplete="off" />}
          </Field>
          <label className="block space-y-1 text-sm font-semibold">
            {t('categoryLabel')}
            <select value={newCat} onChange={(e) => setNewCat(e.target.value as AlertCategory)} className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 text-base font-semibold">
              {ALERT_CATEGORIES.map((c) => <option key={c} value={c}>{tc(c)}</option>)}
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
            <input type="checkbox" className="size-5" checked={newOn} onChange={(e) => setNewOn(e.target.checked)} />
            {t('alertOnLabel')}
          </label>
          <Button type="submit" loading={busy === 'add'} disabled={!newTerm.trim()}>{t('add')}</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('termsTitle')} ({s.terms.length})</h3>
        <p className="text-sm text-muted">{t('termsHint')}</p>
        {ALERT_CATEGORIES.map((c) => {
          const list = s.terms.filter((x) => x.category === c);
          return (
            <details key={c} className="rounded-xl border border-line" data-testid={`terms-${c}`}>
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-3 font-bold">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${CATEGORY_CLASS[c]}`}>{tc(c)}</span>
                <span className="text-sm text-muted">{list.filter((x) => x.alert_enabled && x.active).length}/{list.length}</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {list.map((x) => (
                  <li key={x.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${x.active ? '' : 'opacity-50'}`}>
                    <span className="min-w-0 truncate font-semibold">{x.term}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      {!x.active && <button type="button" className="text-sm font-bold text-brand-700" onClick={() => void saveTerm(x, { active: true }, x.id)}>{t('restore')}</button>}
                      {x.active && <button type="button" className="text-sm text-muted underline" onClick={() => void saveTerm(x, { active: false }, x.id)}>{t('remove')}</button>}
                      <Switch checked={x.alert_enabled} label={x.term} disabled={busy === x.id} testId={`sw-term-${x.term}`} onChange={(v) => void saveTerm(x, { alert_enabled: v }, x.id)} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-extrabold">{t('retentionTitle')}</h3>
        <p className="text-sm text-muted">{t('retentionHint')}</p>
        <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); void setSetting('alerts_retention_days', Number(days)); }}>
          <Field label={t('retentionLabel')}>
            {(id) => <TextInput id={id} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} />}
          </Field>
          <Button type="submit" variant="secondary" loading={busy === 'alerts_retention_days'} disabled={!days || Number(days) === s.retention_days}>{t('save')}</Button>
        </form>
      </Card>
    </>
  );
}
