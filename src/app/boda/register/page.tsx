'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { AppHeader, Page } from '@/components/app-header';
import { PhotoPicker } from '@/components/photo-picker';
import { Banner, Button, Field, PinInput, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { useLocaleContext } from '@/i18n/provider';
import { postApi } from '@/lib/api';

export default function BodaRegisterPage() {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const { locale } = useLocaleContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== pin2) return setError(t('pinMismatch'));
    if (!photo) return setError(errMsg('photo_required'));
    setBusy(true);
    try {
      const form = new FormData();
      form.set('name', name);
      form.set('phone', phone);
      form.set('plate', plate);
      form.set('pin', pin);
      form.set('language', locale); // the language picked at first launch is attached to the account
      form.set('photo', photo);
      await finish(await postApi('/api/auth/boda/register', form), '/boda');
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={t('bodaRegisterTitle')} backHref="/boda/login" />
      <Page>
        <Banner kind="info">{t('bodaRegisterIntro')}</Banner>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('name')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />}
          </Field>
          <Field label={t('phone')} hint={t('phoneHint')}>
            {(id) => <TextInput id={id} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />}
          </Field>
          <Field label={t('plate')} hint={t('plateHint')}>
            {(id) => <TextInput id={id} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={15} />}
          </Field>
          <Field label={t('photo')}>{() => <PhotoPicker value={photo} onChange={setPhoto} />}</Field>
          <Field label={t('pin')} hint={t('pinHint')}>{(id) => <PinInput id={id} value={pin} onChange={setPin} autoComplete="new-password" />}</Field>
          <Field label={t('pinConfirm')}>{(id) => <PinInput id={id} value={pin2} onChange={setPin2} autoComplete="new-password" />}</Field>
          {error && <Banner kind="error">{error}</Banner>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!name || !phone || !plate || pin.length !== 4 || pin2.length !== 4}>
            {t('register')}
          </Button>
        </form>
        <Link href="/boda/login" className="block py-2 text-center font-bold text-brand-700">{t('haveAccount')}</Link>
      </Page>
    </>
  );
}
