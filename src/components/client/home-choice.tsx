'use client';

import { useTranslations } from 'next-intl';

/** First screen of the client app: two big buttons. The Ride flow behind the first one is the one that always existed. */
export function HomeChoice({
  onRide, onShopping, resumeCount,
}: { onRide: () => void; onShopping: () => void; resumeCount: number }) {
  const t = useTranslations('shopping');
  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-center text-2xl font-extrabold">{t('homeTitle')}</h2>
      <button
        type="button"
        onClick={onRide}
        className="block w-full rounded-3xl bg-brand-600 p-7 text-left text-white shadow-md active:bg-brand-700"
      >
        <span className="block text-3xl font-extrabold">🏍️ {t('rideTitle')}</span>
        <span className="mt-1 block text-base opacity-90">{t('rideHint')}</span>
      </button>
      <button
        type="button"
        onClick={onShopping}
        className="block w-full rounded-3xl bg-accent-400 p-7 text-left text-[#1a1200] shadow-md active:bg-accent-500"
      >
        <span className="block text-3xl font-extrabold">🛒 {t('shoppingTitle')}</span>
        <span className="mt-1 block text-base opacity-90">{resumeCount > 0 ? t('resume', { count: resumeCount }) : t('shoppingHint')}</span>
      </button>
    </div>
  );
}
