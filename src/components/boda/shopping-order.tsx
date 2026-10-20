'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Map } from '@/components/map/Map';
import { RideStatusBadge } from '@/components/ride-status-badge';
import { ItemStatusBadge, OrderSteps } from '@/components/shopping-items';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { useRideItems } from '@/hooks/useRideItems';
import { useLocaleContext } from '@/i18n/provider';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { itemLabel, itemProgress } from '@/lib/shopping';
import { getSupabase } from '@/lib/supabase/client';
import type { ItemStatus, Ride, RideItem } from '@/lib/types';

const digits = (s: string) => s.replace(/\D/g, '');
const LIVE = ['accepted', 'shopping', 'purchased', 'delivering'];

/** A required tick box: big target, the whole row is the button. */
function CheckRow({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 text-left text-base font-bold ${checked ? 'border-brand-600 bg-brand-50' : 'border-accent-500 bg-warn-50'}`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 text-lg font-extrabold ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink/40 bg-white text-transparent'}`} aria-hidden>✓</span>
      {label}
    </button>
  );
}

function ItemRow({ item, editable, onSet }: {
  item: RideItem;
  editable: boolean;
  onSet: (status: ItemStatus | null, replacement?: string | null, noReceipt?: boolean | null) => Promise<void>;
}) {
  const t = useTranslations('shoppingBoda');
  const ts = useTranslations('shopping');
  const { locale } = useLocaleContext();
  const [replacement, setReplacement] = useState(item.replacement_text ?? '');
  const name = itemLabel(item, locale);
  const missing = item.status === 'not_found' || item.status === 'replaced';
  const btn = (on: boolean) => `min-h-12 flex-1 rounded-xl border-2 px-3 text-base font-bold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`;

  return (
    <li className="space-y-2 rounded-2xl border border-line bg-white p-3" data-testid="boda-item" data-status={item.status}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-lg font-bold">
          <span className="tabular-nums">{item.quantity}{item.unit ? ` ${ts(`units.${item.unit}` as never)}` : ''}</span> · {name}
        </p>
        <ItemStatusBadge status={item.status} />
      </div>
      {editable && (
        <>
          <div className="flex gap-2">
            <button type="button" className={btn(item.status === 'bought')} aria-label={`${t('bought')}: ${name}`} onClick={() => void onSet(item.status === 'bought' ? 'pending' : 'bought')}>✓ {t('bought')}</button>
            <button type="button" className={`${btn(missing)} ${missing ? '!border-danger !bg-danger' : ''}`} aria-label={`${t('notFound')}: ${name}`} onClick={() => void onSet(missing ? 'pending' : 'not_found')}>✗ {t('notFound')}</button>
          </div>
          {missing && (
            <div className="flex gap-2">
              <TextInput value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder={t('replacementPlaceholder')} aria-label={`${t('replacement')}: ${name}`} maxLength={120} autoComplete="off" />
              <Button variant="secondary" className="shrink-0" onClick={() => void onSet(replacement.trim() ? 'replaced' : 'not_found', replacement)}>{t('saveReplacement')}</Button>
            </div>
          )}
          {item.status !== 'pending' && (
            <button
              type="button"
              role="checkbox"
              aria-checked={item.no_receipt}
              aria-label={`${t('noReceipt')}: ${name}`}
              onClick={() => void onSet(null, null, !item.no_receipt)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-left text-base font-semibold"
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-md border-2 text-base font-extrabold ${item.no_receipt ? 'border-accent-500 bg-accent-400 text-[#1a1200]' : 'border-line bg-white text-transparent'}`} aria-hidden>✓</span>
              🧾 {t('noReceipt')}
            </button>
          )}
        </>
      )}
      {!editable && item.status === 'replaced' && item.replacement_text && <p className="text-sm font-semibold text-[#7a5a00]">↔ {item.replacement_text}</p>}
      {!editable && item.no_receipt && <p className="text-xs font-semibold text-muted">🧾 {t('noReceipt')}</p>}
    </li>
  );
}

/**
 * The Boda's running shopping order. Five stages, one big button each:
 *   accepted -> "I'm shopping" -> "Shopping done" (items total + receipts kept) -> "On my way" -> "Delivered" (fee + receipts shown)
 * The receipts banner (shown by the page above this card) stays on screen the whole time.
 */
export function BodaShoppingOrder({ ride, myPos, onChanged }: { ride: Ride; myPos: LatLng | null; onChanged: () => void }) {
  const t = useTranslations('shoppingBoda');
  const tb = useTranslations('boda');
  const tc = useTranslations('common');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const { items, reload } = useRideItems(ride.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [total, setTotal] = useState('');
  const [kept, setKept] = useState(false);
  const [fee, setFee] = useState('');
  const [shown, setShown] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const place = { lat: ride.pickup_lat, lng: ride.pickup_lng };
  const progress = itemProgress(items);
  const editable = ride.status === 'shopping' || ride.status === 'purchased';
  const waPhone = ride.client_phone ? digits(ride.client_phone) : null;
  const showPhone = !!ride.client_phone && LIVE.includes(ride.status);

  async function step(label: string, fn: string, args: Record<string, unknown>) {
    setBusy(label);
    const { error } = await getSupabase().rpc(fn, args);
    if (error) toast.show(te(error), 'error');
    setBusy(null);
    setConfirmCancel(false);
    onChanged();
  }

  async function setItem(id: string, status: ItemStatus | null, replacement: string | null = null, noReceipt: boolean | null = null) {
    const { error } = await getSupabase().rpc('shopping_set_item', { p_item_id: id, p_status: status, p_replacement: replacement, p_no_receipt: noReceipt });
    if (error) toast.show(te(error), 'error');
    await reload();
  }

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  return (
    <Card className="space-y-4 border-2 border-brand-500" data-testid="boda-shopping-order">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-accent-400 px-3 py-1 text-sm font-extrabold text-[#1a1200]">🛒 {t('badge')}</span>
          <p className="mt-1 truncate text-2xl font-extrabold">{ride.client_name}</p>
        </div>
        <RideStatusBadge status={ride.status} />
      </div>
      <OrderSteps status={ride.status} />

      {showPhone && (
        <div className="grid grid-cols-2 gap-2" data-testid="client-contact">
          <a href={`tel:${ride.client_phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 bg-white font-bold text-brand-700 active:bg-brand-50">📞 {t('call')}</a>
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[#1da851] bg-[#e8f8ee] font-bold text-[#0f6b34] active:opacity-80">💬 {t('whatsapp')}</a>
        </div>
      )}

      <dl className="space-y-1 text-base">
        <div className="flex flex-wrap gap-x-4">
          <div><dt className="inline font-semibold">{t('budgetLabel')}: </dt><dd className="inline">{ride.budget_max_kes !== null ? fmt.ksh(ride.budget_max_kes) : t('noBudget')}</dd></div>
          {ride.items_total_kes !== null && <div><dt className="inline font-semibold">{t('itemsTotal')}: </dt><dd className="inline font-extrabold" data-testid="boda-items-total">{fmt.ksh(ride.items_total_kes)}</dd></div>}
        </div>
        {ride.delivery_landmark && <div className="flex gap-2"><dt className="font-semibold">{t('landmark')}:</dt><dd className="min-w-0 break-words">{ride.delivery_landmark}</dd></div>}
        {ride.client_note && <div className="flex gap-2"><dt className="font-semibold">{t('note')}:</dt><dd className="min-w-0 break-words">{ride.client_note}</dd></div>}
        {myPos && ride.status !== 'shopping' && ride.status !== 'purchased' && (
          <div className="font-semibold">{tb('distanceFromYou', { distance: fmt.distance(distanceMeters(myPos, place)) })}</div>
        )}
      </dl>

      <Map
        className="h-44 w-full"
        markers={[
          { id: 'pickup', ...place, kind: 'pickup', label: ride.client_name },
          ...(myPos ? [{ id: 'me', ...myPos, kind: 'me' as const }] : []),
        ]}
        view={{ center: place, zoom: 16, key: ride.id }}
        fitKey={`${ride.id}:${myPos ? 1 : 0}`}
      />

      <div className="space-y-2">
        <h3 className="text-lg font-extrabold">{t('listTitle', { done: progress.done, count: items.length })}</h3>
        {ride.status === 'accepted' && <p className="text-sm text-muted">{t('startToTick')}</p>}
        <ul className="space-y-2">
          {items.map((i) => <ItemRow key={`${i.id}:${i.status}:${i.no_receipt}`} item={i} editable={editable} onSet={(s, r, n) => setItem(i.id, s, r, n)} />)}
        </ul>
      </div>

      {/* ---------------- the five stages ---------------- */}
      {ride.status === 'accepted' && (
        <Button size="lg" className="w-full" loading={busy === 'start'} onClick={() => step('start', 'shopping_start', { p_ride_id: ride.id })}>🛒 {t('btnShopping')}</Button>
      )}

      {ride.status === 'shopping' && (
        <div className="space-y-3 rounded-2xl bg-brand-50 p-3">
          <Field label={t('itemsTotalInput')} hint={progress.pending > 0 ? t('stillPending', { count: progress.pending }) : undefined}>
            {(id) => <TextInput id={id} value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="850" autoComplete="off" />}
          </Field>
          <CheckRow checked={kept} onChange={setKept} label={t('receiptsKept')} testId="receipts-kept" />
          <Button size="lg" className="w-full" loading={busy === 'purchased'} disabled={num(total) === null || !kept}
            onClick={() => step('purchased', 'shopping_purchased', { p_ride_id: ride.id, p_items_total_kes: num(total), p_receipts_kept: kept })}>
            ✅ {t('btnPurchased')}
          </Button>
          {(num(total) === null || !kept) && <p className="text-center text-sm font-semibold text-[#7a5a00]">{t('purchasedNeeds')}</p>}
        </div>
      )}

      {ride.status === 'purchased' && (
        <Button size="lg" className="w-full" loading={busy === 'deliver'} onClick={() => step('deliver', 'shopping_deliver_start', { p_ride_id: ride.id })}>🏍️ {t('btnDelivering')}</Button>
      )}

      {ride.status === 'delivering' && (
        <div className="space-y-3 rounded-2xl bg-brand-50 p-3">
          <Field label={t('deliveryFeeInput')}>
            {(id) => <TextInput id={id} value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="100" autoComplete="off" />}
          </Field>
          <CheckRow checked={shown} onChange={setShown} label={t('receiptsShown')} testId="receipts-shown" />
          <Button size="lg" variant="accent" className="w-full" loading={busy === 'complete'} disabled={num(fee) === null || !shown}
            onClick={() => step('complete', 'shopping_complete', { p_ride_id: ride.id, p_delivery_fee_kes: num(fee), p_receipts_shown: shown })}>
            📦 {t('btnDelivered')}
          </Button>
          {(num(fee) === null || !shown) && <p className="text-center text-sm font-semibold text-[#7a5a00]">{t('deliveredNeeds')}</p>}
        </div>
      )}

      {!confirmCancel ? (
        <Button variant="ghost" className="w-full text-danger" onClick={() => setConfirmCancel(true)}>{tb('cancelRide')}</Button>
      ) : (
        <Banner kind="error">
          <p className="mb-2 text-center">{tb('cancelConfirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>{tc('no')}</Button>
            <Button variant="danger" loading={busy === 'cancel'} onClick={() => step('cancel', 'cancel_ride', { p_ride_id: ride.id })}>{tc('yes')}</Button>
          </div>
        </Banner>
      )}
    </Card>
  );
}
