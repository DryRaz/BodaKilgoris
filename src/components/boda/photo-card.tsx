'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { PhotoPicker } from '@/components/photo-picker';
import { useToast } from '@/components/toast';
import { Button, Card } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { postApi } from '@/lib/api';

/**
 * Adds / changes the Boda's photo after registration. With `nudge` (no photo yet) it is shown as a
 * friendly reminder on the home screen; it is never a blocker.
 */
export function BodaPhotoCard({ nudge = false }: { nudge?: boolean }) {
  const t = useTranslations('boda');
  const errMsg = useErrorMessage();
  const toast = useToast();
  const { refresh } = useAuth();
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!photo) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set('photo', photo);
      await postApi('/api/boda/photo', form);
      toast.show(t('photoSaved'), 'success');
      setPhoto(null);
      await refresh();
    } catch (err) {
      toast.show(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={nudge ? 'space-y-3 border-2 border-accent-400 bg-warn-50' : 'space-y-3'}>
      <h2 className="text-lg font-extrabold">{nudge ? `📷 ${t('photoReminderTitle')}` : t('photoYour')}</h2>
      {nudge && <p className="text-base">{t('photoReminderBody')}</p>}
      <PhotoPicker value={photo} onChange={setPhoto} showHint={false} />
      {photo && <Button className="w-full" loading={busy} onClick={() => void save()}>{t('photoSave')}</Button>}
    </Card>
  );
}
