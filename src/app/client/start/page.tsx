'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AppHeader, Page } from '@/components/app-header';
import { Banner, Button, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { useLocaleContext } from '@/i18n/provider';
import { postApi } from '@/lib/api';

export default function ClientStartPage() {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const { locale } = useLocaleContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await finish(await postApi('/api/auth/client/start', { name, phone, language: locale }), '/client');
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={t('clientStartTitle')} backHref="/" />
      <Page>
        <p className="text-base text-muted">{t('clientStartIntro')}</p>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('name')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />}
          </Field>
          <Field label={t('phone')} hint={t('phoneHint')}>
            {(id) => <TextInput id={id} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />}
          </Field>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!phone || name.trim().length < 2}>
            {t('start')}
          </Button>
        </form>
      </Page>
    </>
  );
}
