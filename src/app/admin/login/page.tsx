'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AppHeader, Page } from '@/components/app-header';
import { Banner, Button, Field, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { postApi } from '@/lib/api';

export default function AdminLoginPage() {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await finish(await postApi('/api/auth/admin/login', { email, password }), '/admin');
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={t('adminLoginTitle')} backHref="/" />
      <Page>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('email')}>
            {(id) => <TextInput id={id} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />}
          </Field>
          <Field label={t('password')}>
            {(id) => <TextInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />}
          </Field>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password}>{t('login')}</Button>
        </form>
      </Page>
    </>
  );
}
