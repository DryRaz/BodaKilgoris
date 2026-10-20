'use client';

import { useTranslations } from 'next-intl';

/**
 * Warm, sticky reminder shown at the top of the Boda screen during EVERY step of a shopping order
 * (accepted -> delivered): the client repays against the receipts, so they must all be kept and shown.
 */
export function ReceiptsBanner() {
  const t = useTranslations('shoppingBoda');
  return (
    <div
      role="note"
      data-testid="receipts-banner"
      className="sticky top-[57px] z-[1000] rounded-2xl border-2 border-accent-500 bg-accent-400 px-4 py-3 text-[#1a1200] shadow-md"
    >
      <p className="text-base font-extrabold leading-snug">🧾 {t('receiptsBanner')}</p>
    </div>
  );
}
