'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { homeFor, useAuth } from '@/components/auth-provider';
import { LanguageSwitcher } from '@/components/language';
import { InstallPrompt } from '@/components/pwa';
import { useToast } from '@/components/toast';
import { Button, Card } from '@/components/ui';
import { formatPhone } from '@/lib/phone';
import { APP_VERSION } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase/client';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tg = useTranslations('geo');
  const tl = useTranslations('language');
  const tc = useTranslations('common');
  const { profile, loading, refresh, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (loading) return (<><AppHeader title={t('title')} backHref="/" /><Loading /></>);

  async function withdraw() {
    setBusy(true);
    const { error } = await getSupabase().rpc('set_geo_consent', { p_given: false });
    if (!error) {
      await refresh();
      toast.show(tg('withdrawn'), 'success');
    }
    setBusy(false);
  }

  return (
    <>
      <AppHeader title={t('title')} backHref={profile ? homeFor(profile.role) : '/'} />
      <Page>
        <Card className="space-y-3">
          <h2 className="text-lg font-extrabold">{tl('label')}</h2>
          <LanguageSwitcher />
        </Card>

        {profile && (
          <>
            <Card className="space-y-1">
              <h2 className="text-lg font-extrabold">{t('account')}</h2>
              <p className="font-semibold">{profile.name}</p>
              {profile.phone && <p className="text-muted">{formatPhone(profile.phone)}</p>}
            </Card>

            {profile.role !== 'admin' && (
              <Card className="space-y-3">
                <h2 className="text-lg font-extrabold">{t('location')}</h2>
                <p className="text-base">{profile.geo_consent_at ? tg('consentGiven') : tg('consentNone')}</p>
                {profile.geo_consent_at && (
                  <Button variant="secondary" loading={busy} onClick={withdraw}>{tg('withdraw')}</Button>
                )}
              </Card>
            )}

            <Button variant="danger" className="w-full" onClick={signOut}>{tc('logout')}</Button>
          </>
        )}

        <InstallPrompt />
        <Card className="space-y-1 text-sm text-muted">
          <h2 className="text-lg font-extrabold text-ink">{t('about')}</h2>
          <p>{t('phaseNote')}</p>
          <p>{t('version', { version: APP_VERSION })}</p>
        </Card>
      </Page>
    </>
  );
}
