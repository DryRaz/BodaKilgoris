'use client';

import { useTranslations } from 'next-intl';
import { ItemsList, OrderSteps } from '@/components/shopping-items';
import { Banner, Card } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useRideItems } from '@/hooks/useRideItems';
import type { Ride } from '@/lib/types';

/** What the client sees while a shopping order runs: stages, the items total the moment the Boda enters it, live item status. */
export function ShoppingOrderPanel({ ride }: { ride: Ride }) {
  const t = useTranslations('shopping');
  const fmt = useFormat();
  const { items } = useRideItems(ride.id);
  const overBudget = ride.items_total_kes !== null && ride.budget_max_kes !== null && ride.items_total_kes > ride.budget_max_kes;

  return (
    <div className="space-y-3">
      {ride.status !== 'requested' && <OrderSteps status={ride.status} />}

      {ride.items_total_kes !== null && (
        <Banner kind="success">
          <p className="text-xl font-extrabold" data-testid="items-total">{t('itemsTotal', { amount: fmt.ksh(ride.items_total_kes) })}</p>
          <p className="mt-1 text-sm font-semibold">{t('repayNotice')}</p>
          {overBudget && <p className="mt-1 text-sm font-bold text-danger">{t('overBudget', { budget: fmt.ksh(ride.budget_max_kes!) })}</p>}
        </Banner>
      )}

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold">🛒 {t('yourList', { count: ride.items_count })}</h3>
          {ride.budget_max_kes !== null && <span className="text-sm font-semibold text-muted">{t('budgetShort', { amount: fmt.ksh(ride.budget_max_kes) })}</span>}
        </div>
        {items.length > 0 && <ItemsList items={items} showStatus={ride.status !== 'requested' && ride.status !== 'accepted'} />}
        {ride.client_note && <p className="text-sm text-muted">📝 {ride.client_note}</p>}
        {ride.delivery_landmark && <p className="text-sm text-muted">📍 {ride.delivery_landmark}</p>}
      </Card>
    </div>
  );
}
