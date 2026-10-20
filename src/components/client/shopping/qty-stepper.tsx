'use client';

import { useTranslations } from 'next-intl';
import { MAX_QUANTITY, unitStep } from '@/lib/shopping';

/** − 2 kg + : big touch targets (48 px) for thumbs and cheap screens. */
export function QtyStepper({
  value, unit, onChange, name,
}: { value: number; unit?: string | null; onChange: (v: number) => void; name: string }) {
  const t = useTranslations('shopping');
  const step = unitStep(unit);
  const btn = 'grid size-12 shrink-0 place-items-center rounded-full border-2 border-line bg-white text-2xl font-extrabold leading-none active:bg-brand-50 disabled:opacity-40';
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} aria-label={`${t('less')}: ${name}`} disabled={value <= step} onClick={() => onChange(Math.max(step, value - step))}>−</button>
      <span className="min-w-14 text-center text-base font-extrabold tabular-nums" data-testid="qty">
        {value}
        {unit ? <span className="block text-[11px] font-semibold leading-none text-muted">{t(`units.${unit}` as never)}</span> : null}
      </span>
      <button type="button" className={btn} aria-label={`${t('more')}: ${name}`} disabled={value >= MAX_QUANTITY} onClick={() => onChange(Math.min(MAX_QUANTITY, value + step))}>+</button>
    </div>
  );
}
