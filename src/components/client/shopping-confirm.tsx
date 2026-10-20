'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ItemsList } from '@/components/shopping-items';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, StarInput, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { useRideItems } from '@/hooks/useRideItems';
import { getSupabase } from '@/lib/supabase/client';
import type { ProblemType, Ride } from '@/lib/types';

const PROBLEMS: ProblemType[] = ['receipts_not_shown', 'total_mismatch', 'missing_item', 'other'];

/**
 * Delivery confirmation. The Boda advanced the money: here the client sees the list, the totals and — in bold —
 * that the receipts must be checked BEFORE confirming. Counting happens only once the client confirms.
 */
export function ShoppingConfirmCard({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const t = useTranslations('shopping');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const { items } = useRideItems(ride.id);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ProblemType | null>(null);
  const [details, setDetails] = useState('');
  const [reported, setReported] = useState(ride.problem_reported);

  async function confirm() {
    setBusy(true);
    const { error } = await getSupabase().rpc('confirm_ride', { p_ride_id: ride.id, p_rating: rating });
    if (error) toast.show(te(error), 'error');
    else toast.show(t('deliveryThanks'), 'success');
    setBusy(false);
    onDone();
  }

  async function report() {
    if (!reason) return;
    setBusy(true);
    const { error } = await getSupabase().rpc('report_ride_problem', { p_ride_id: ride.id, p_type: reason, p_text: details.trim() || null });
    setBusy(false);
    if (error) return toast.show(te(error), 'error');
    setReported(true);
    setReporting(false);
    toast.show(t('problemSent'), 'success');
  }

  const total = (ride.items_total_kes ?? 0) + (ride.delivery_fee_kes ?? 0);

  return (
    <Card className="space-y-4 border-2 border-brand-500">
      <div className="text-center">
        <div className="text-5xl" aria-hidden>📦</div>
        <h2 className="text-2xl font-extrabold">{t('deliveredTitle')}</h2>
        <p className="mt-1 text-lg font-semibold">{ride.boda_name}</p>
      </div>

      <Banner kind="warn">
        <p className="text-lg font-extrabold" data-testid="receipts-notice">🧾 {t('receiptsNotice')}</p>
      </Banner>

      {items.length > 0 && <ItemsList items={items} />}

      <dl className="space-y-1 rounded-2xl bg-canvas p-3 text-base">
        <div className="flex justify-between gap-3"><dt>{t('itemsTotalLabel')}</dt><dd className="font-extrabold tabular-nums" data-testid="confirm-items-total">{ride.items_total_kes !== null ? fmt.ksh(ride.items_total_kes) : '–'}</dd></div>
        <div className="flex justify-between gap-3"><dt>{t('deliveryFee')}</dt><dd className="font-extrabold tabular-nums" data-testid="confirm-delivery-fee">{ride.delivery_fee_kes !== null ? fmt.ksh(ride.delivery_fee_kes) : '–'}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line pt-1 text-lg"><dt className="font-bold">{t('totalToRepay')}</dt><dd className="font-extrabold tabular-nums">{fmt.ksh(total)}</dd></div>
        <p className="pt-1 text-xs text-muted">{t('repayNotice')}</p>
      </dl>

      <div className="space-y-1 text-center">
        <p className="font-bold">{t('rateTitle')}</p>
        <StarInput value={rating} onChange={setRating} />
        <p className="text-sm text-muted">{t('rateOptional')}</p>
      </div>

      {reported && <Banner kind="success">{t('problemSent')}</Banner>}

      {!reporting ? (
        <div className="space-y-2">
          <Button size="lg" className="w-full" loading={busy} onClick={() => void confirm()}>{t('confirmDelivery')}</Button>
          {!reported && <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setReporting(true)}>⚠️ {t('reportProblem')}</Button>}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border-2 border-danger/40 bg-danger-50 p-3">
          <p className="font-extrabold text-danger">{t('problemTitle')}</p>
          <div role="radiogroup" aria-label={t('problemTitle')} className="space-y-2">
            {PROBLEMS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={reason === p}
                onClick={() => setReason(p)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 text-left text-base font-semibold ${reason === p ? 'border-danger bg-white' : 'border-line bg-white'}`}
              >
                <span aria-hidden className={`grid size-6 place-items-center rounded-full border-2 ${reason === p ? 'border-danger bg-danger text-white' : 'border-line'}`}>{reason === p ? '●' : ''}</span>
                {t(`problems.${p}`)}
              </button>
            ))}
          </div>
          <Field label={t('problemDetails')}>
            {(id) => <TextInput id={id} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} autoComplete="off" />}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setReporting(false)} disabled={busy}>{t('cancelReport')}</Button>
            <Button variant="danger" loading={busy} disabled={!reason} onClick={() => void report()}>{t('sendReport')}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
