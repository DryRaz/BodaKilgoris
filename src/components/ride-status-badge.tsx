'use client';

import { useTranslations } from 'next-intl';
import type { RideStatus } from '@/lib/types';

const COLORS: Record<RideStatus, string> = {
  requested: 'bg-warn-50 text-[#7a5a00]',
  accepted: 'bg-brand-100 text-brand-900',
  arrived: 'bg-brand-600 text-white',
  completed: 'bg-brand-900 text-white',
  declined: 'bg-danger-50 text-danger',
  expired: 'bg-line text-muted',
  cancelled: 'bg-danger-50 text-danger',
};

export function RideStatusBadge({ status }: { status: RideStatus }) {
  const t = useTranslations('ride.status');
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${COLORS[status]}`}>{t(status)}</span>;
}
