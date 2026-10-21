'use client';

import { useTranslations } from 'next-intl';
import { AppHeader, Page } from '@/components/app-header';
import { Card } from '@/components/ui';

/** Public page (no login needed): what the app team can see, in plain words. */
export default function PrivacyPage() {
  const t = useTranslations('privacy');
  return (
    <>
      <AppHeader title={t('title')} backHref="/settings" />
      <Page>
        <Card className="space-y-3">
          <p className="text-lg" data-testid="privacy-text">{t('notice')}</p>
          <p className="text-base text-muted">{t('more')}</p>
        </Card>
      </Page>
    </>
  );
}
