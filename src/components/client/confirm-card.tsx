'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, StarInput } from '@/components/ui';
import { ShoppingConfirmCard } from '@/components/client/shopping-confirm';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFormat } from '@/hooks/useFormat';
import { getSupabase } from '@/lib/supabase/client';
import type { Ride } from '@/lib/types';

/** The ride is only counted once the client confirms (or after 30 min, automatically). */
export function ConfirmCard({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  if (ride.type === 'shopping') return <ShoppingConfirmCard ride={ride} onDone={onDone} />;
  return <RideConfirmCard ride={ride} onDone={onDone} />;
}

function RideConfirmCard({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const t = useTranslations('client');
  const te = useErrorMessage();
  const toast = useToast();
  const fmt = useFormat();
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const { error } = await getSupabase().rpc('confirm_ride', { p_ride_id: ride.id, p_rating: rating });
    if (error) toast.show(te(error), 'error');
    else toast.show(t('thanks'), 'success');
    setBusy(false);
    onDone();
  }

  return (
    <Card className="space-y-5 border-2 border-brand-500 text-center">
      <div className="text-5xl" aria-hidden>🏁</div>
      <div>
        <h2 className="text-2xl font-extrabold">{t('completedTitle')}</h2>
        <p className="mt-1 text-lg font-semibold">{ride.boda_name}</p>
        <p className="mt-1 text-base text-muted">{t('completedBody')}</p>
        {ride.agreed_price_kes !== null && (
          <p className="mt-2 text-base font-semibold">{t('priceNoted', { amount: fmt.kes(ride.agreed_price_kes) })}</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="font-bold">{t('rateTitle')}</p>
        <StarInput value={rating} onChange={setRating} />
        <p className="text-sm text-muted">{t('rateOptional')}</p>
      </div>
      <Button size="lg" className="w-full" loading={busy} onClick={() => void confirm()}>{t('confirm')}</Button>
    </Card>
  );
}
