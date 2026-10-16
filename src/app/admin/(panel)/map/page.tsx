'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Map } from '@/components/map/Map';
import { Card, Stars } from '@/components/ui';
import { useAvailableBodas } from '@/hooks/useAvailableBodas';

export default function AdminMapPage() {
  const t = useTranslations('admin.map');
  const { bodas, loaded } = useAvailableBodas(true);
  const markers = useMemo(
    () => bodas.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng, label: b.name, kind: 'boda' as const })),
    [bodas],
  );

  return (
    <>
      <h2 className="text-2xl font-extrabold">{t('count', { count: bodas.length })}</h2>
      <Map className="h-[60dvh] min-h-80 w-full" markers={markers} fitKey={`${bodas.length}`} />
      {loaded && bodas.length === 0 && <Card className="text-center text-muted">{t('none')}</Card>}
      <ul className="grid gap-2 md:grid-cols-2">
        {bodas.map((b) => (
          <li key={b.id}>
            <Card className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-bold">{b.name}</span>
                <span className="text-sm text-muted">{b.plate}</span>
              </span>
              {b.rating_count > 0 && <Stars value={Number(b.rating_avg)} count={b.rating_count} size="text-sm" />}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
