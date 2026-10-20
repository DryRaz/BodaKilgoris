'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { distanceParts, formatDuration } from '@/lib/geo';

const kesFormat = new Intl.NumberFormat('en-KE');

export function useFormat() {
  const t = useTranslations('common');
  return useMemo(
    () => ({
      distance: (meters: number) => {
        const p = distanceParts(meters);
        return p.unit === 'km' ? t('km', { value: p.value }) : t('meters', { value: p.value });
      },
      countdown: formatDuration,
      kes: (amount: number) => t('kes', { amount: kesFormat.format(amount) }),
      /** "KSh 1,200": the way shopping amounts are written (rides keep their existing "KES" format). */
      ksh: (amount: number) => t('ksh', { amount: kesFormat.format(amount) }),
    }),
    [t],
  );
}
