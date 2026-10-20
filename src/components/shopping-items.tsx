'use client';

import { useTranslations } from 'next-intl';
import { useLocaleContext } from '@/i18n/provider';
import { itemLabel } from '@/lib/shopping';
import type { ItemStatus, RideItem } from '@/lib/types';

const STYLE: Record<ItemStatus, string> = {
  pending: 'bg-line text-muted',
  bought: 'bg-brand-100 text-brand-900',
  not_found: 'bg-danger-50 text-danger',
  replaced: 'bg-warn-50 text-[#7a5a00]',
};
const ICON: Record<ItemStatus, string> = { pending: '•', bought: '✓', not_found: '✗', replaced: '↔' };

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const t = useTranslations('shopping.itemStatus');
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${STYLE[status]}`}>{ICON[status]} {t(status)}</span>;
}

/** "2 kg · Sugar" with the Boda's progress next to each line (bought / not found / replaced). Read-only. */
export function ItemsList({ items, showStatus = true }: { items: RideItem[]; showStatus?: boolean }) {
  const t = useTranslations('shopping');
  const { locale } = useLocaleContext();
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((i) => (
        <li key={i.id} className="space-y-0.5 px-3 py-2" data-testid="order-item" data-status={i.status}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-base font-bold">
              <span className="tabular-nums">{i.quantity}{i.unit ? ` ${t(`units.${i.unit}` as never)}` : ''}</span> · {itemLabel(i, locale)}
            </p>
            {showStatus && <ItemStatusBadge status={i.status} />}
          </div>
          {i.status === 'replaced' && i.replacement_text && <p className="text-sm font-semibold text-[#7a5a00]">↔ {i.replacement_text}</p>}
          {i.no_receipt && <p className="text-xs font-semibold text-muted">🧾 {t('noReceipt')}</p>}
        </li>
      ))}
    </ul>
  );
}

const STEPS = ['accepted', 'shopping', 'purchased', 'delivering', 'completed'] as const;

/** The five stages of a shopping order, the current one highlighted. */
export function OrderSteps({ status }: { status: string }) {
  const t = useTranslations('shopping.steps');
  const current = Math.max(0, STEPS.indexOf(status as (typeof STEPS)[number]));
  return (
    <ol className="flex gap-1" aria-label={t(STEPS[current])}>
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className="min-w-0 flex-1 text-center">
          <span className={`block h-2 rounded-full ${i <= current ? 'bg-brand-600' : 'bg-line'}`} />
          <span className={`mt-1 block truncate text-[11px] leading-tight ${i === current ? 'font-extrabold text-brand-700' : 'text-muted'}`}>{t(s)}</span>
        </li>
      ))}
    </ol>
  );
}
