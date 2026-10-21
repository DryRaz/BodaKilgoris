'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui';
import { getSupabase } from '@/lib/supabase/client';

/**
 * One-time notice shown to a client before their FIRST order is sent. It never blocks anything:
 * the "Send" button works whether the notice is ticked, closed or ignored.
 * - tick "I understand"   -> notice_shown_at + notice_accepted_at
 * - close it / send anyway -> notice_shown_at only (so it is not shown again)
 */
export function usePrivacyNotice() {
  const { profile, refresh } = useAuth();
  const [done, setDone] = useState(false);
  const visible = !!profile && profile.role === 'client' && !profile.notice_shown_at && !done;

  const record = useCallback(async (accepted: boolean) => {
    setDone(true);
    const { error } = await getSupabase().rpc('record_notice', { p_accepted: accepted });
    if (error) {
      console.error('[notice] record_notice failed', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      return;
    }
    void refresh();
  }, [refresh]);

  /** Called after an order was sent: the notice counts as shown even if the client ignored it. */
  const markSent = useCallback(() => {
    if (visible) void record(false);
  }, [visible, record]);

  return { visible, record, markSent };
}

export function PrivacyNotice({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  const t = useTranslations('privacy');
  return (
    <Card className="space-y-3 border-2 border-brand-500 bg-brand-50" data-testid="privacy-notice" role="note">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base">{t('notice')}</p>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-10 shrink-0 place-items-center rounded-full text-xl text-muted active:bg-line">✕</button>
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base font-bold">
        <input type="checkbox" className="size-6" data-testid="privacy-ack" onChange={(e) => e.target.checked && onAccept()} />
        {t('understood')}
      </label>
      <Link href="/privacy" className="text-sm font-semibold text-brand-700 underline">{t('link')}</Link>
    </Card>
  );
}
