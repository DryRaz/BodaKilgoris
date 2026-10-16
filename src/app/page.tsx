'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { homeFor, useAuth } from '@/components/auth-provider';
import { InstallPrompt } from '@/components/pwa';
import { Banner } from '@/components/ui';

export default function WelcomePage() {
  const t = useTranslations('welcome');
  const tc = useTranslations('common');
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile) router.replace(homeFor(profile.role));
  }, [profile, router]);

  if (loading || profile) return (<><AppHeader /><Loading /></>);

  return (
    <>
      <AppHeader />
      <Page>
        <div className="pt-4 text-center">
          <div className="mx-auto mb-3 grid size-20 place-items-center rounded-3xl bg-brand-600 text-5xl shadow-lg" aria-hidden>🏍️</div>
          <h2 className="text-3xl font-extrabold">{tc('appName')}</h2>
          <p className="mt-1 text-lg text-muted">{tc('tagline')}</p>
        </div>

        <Banner kind="success">{tc('freeBanner')}</Banner>
        <p className="text-center text-base text-muted">{t('intro')}</p>

        <div className="space-y-3">
          <Link href="/client/start" className="block rounded-3xl bg-brand-600 p-6 text-white shadow-md active:bg-brand-700">
            <span className="block text-2xl font-extrabold">🧍🏾 {t('iAmClient')}</span>
            <span className="mt-1 block text-base opacity-90">{t('iAmClientHint')}</span>
          </Link>
          <Link href="/boda/login" className="block rounded-3xl bg-accent-400 p-6 text-[#1a1200] shadow-md active:bg-accent-500">
            <span className="block text-2xl font-extrabold">🏍️ {t('iAmBoda')}</span>
            <span className="mt-1 block text-base opacity-90">{t('iAmBodaHint')}</span>
          </Link>
        </div>

        <InstallPrompt />
        <p className="text-center text-sm text-muted">{t('paymentNote')}</p>
        <p className="pb-2 text-center">
          <Link href="/admin/login" className="text-sm font-semibold text-muted underline">{t('admin')}</Link>
        </p>
      </Page>
    </>
  );
}
