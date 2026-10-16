'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { AppHeader, Page } from '@/components/app-header';
import { Banner, Button, Field, PinInput, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { postApi } from '@/lib/api';

export default function BodaLoginPage() {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await finish(await postApi('/api/auth/boda/login', { phone, pin }), '/boda');
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={t('bodaLoginTitle')} backHref="/" />
      <Page>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('phone')} hint={t('phoneHint')}>
            {(id) => <TextInput id={id} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />}
          </Field>
          <Field label={t('pin')}>{(id) => <PinInput id={id} value={pin} onChange={setPin} autoComplete="current-password" />}</Field>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!phone || pin.length !== 4}>
            {t('login')}
          </Button>
        </form>
        <Link href="/boda/register" className="block rounded-2xl border-2 border-line bg-white py-4 text-center font-bold text-brand-700">
          {t('noAccount')}
        </Link>
      </Page>
    </>
  );
}
