'use client';

import { useTranslations } from 'next-intl';
import { destinationPoint } from '@/lib/ride-map';
import type { Ride } from '@/lib/types';

/**
 * Destination + pick-up landmark, as the client gave them. The destination is optional in every way:
 * text, a pin, both, or nothing. "Nothing" is shown as a clear to-do for the Boda, never as a blank.
 */
export function RideDetails({ ride }: { ride: Pick<Ride, 'destination_text' | 'destination_lat' | 'destination_lng' | 'pickup_note'> }) {
  const t = useTranslations('boda');
  const text = ride.destination_text?.trim();
  const pinned = destinationPoint(ride) !== null;

  return (
    <>
      <div className="flex gap-2">
        <dt className="font-semibold">{t('destination')}:</dt>
        <dd className="min-w-0 break-words">
          {text ? (
            <>
              {text}
              {pinned && <span className="block text-sm font-semibold text-brand-700">🏁 {t('destinationOnMap')}</span>}
            </>
          ) : pinned ? (
            <span className="font-semibold text-brand-700">🏁 {t('destinationOnMap')}</span>
          ) : (
            <span className="rounded-md bg-warn-50 px-2 py-0.5 font-bold text-[#7a5a00]">{t('destinationToClarify')}</span>
          )}
        </dd>
      </div>
      {ride.pickup_note?.trim() && (
        <div className="flex gap-2">
          <dt className="font-semibold">{t('pickupNote')}:</dt>
          <dd className="min-w-0 break-words">{ride.pickup_note.trim()}</dd>
        </div>
      )}
    </>
  );
}
