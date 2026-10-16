'use client';

import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/ui';

export function AvailabilityToggle({
  available, busy, onToggle,
}: { available: boolean; busy: boolean; onToggle: () => void }) {
  const t = useTranslations('boda');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={available}
      className={`relative w-full rounded-3xl px-6 py-8 text-left shadow-md transition-colors disabled:opacity-80 ${
        available ? 'bg-brand-600 text-white' : 'bg-white text-ink ring-2 ring-line'
      }`}
    >
      <span className="flex items-center gap-4">
        <span
          className={`grid size-16 shrink-0 place-items-center rounded-full text-3xl ${
            available ? 'pulse-ring bg-white/20' : 'bg-line'
          }`}
          aria-hidden
        >
          {busy ? <Spinner className="size-8" /> : available ? '🟢' : '⚪'}
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-extrabold leading-tight">
            {available ? t('available') : t('unavailable')}
          </span>
          <span className={`mt-1 block text-base ${available ? 'text-white/90' : 'text-muted'}`}>
            {busy ? t('gettingLocation') : available ? t('tapToGoOffline') : t('tapToGoOnline')}
          </span>
        </span>
      </span>
    </button>
  );
}
