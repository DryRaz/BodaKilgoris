'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppHeader, Loading, Page } from '@/components/app-header';
import { useAuth } from '@/components/auth-provider';
import { PhotoUploader } from '@/components/photo-picker';
import { Banner, Button, Field, PinInput, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { isLocale } from '@/i18n/config';
import { useLocaleContext } from '@/i18n/provider';
import { postApi } from '@/lib/api';
import { logClient } from '@/lib/clientlog';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';

/**
 * Two steps, so a crash around the camera can never lose the registration:
 *   1. details  -> creates the account (no photo) and signs the Boda in
 *   2. photo    -> optional; the camera opens only now, when the account already exists
 * The typed fields are kept in localStorage (never the PIN) and the signed-in session survives a
 * reload, so coming back lands on the same step.
 */
export default function BodaRegisterPage() {
  const t = useTranslations('auth');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const router = useRouter();
  const { profile, boda, loading, refresh } = useAuth();
  const { locale, setLocale } = useLocaleContext();
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [restarted, setRestarted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoDone, setPhotoDone] = useState(false);

  // the account exists and is a Boda: we are in step 2, whatever happened to the page meanwhile
  const photoStep = profile?.role === 'boda';

  // ---- restore the draft once, after mount (localStorage is not available during SSR) ----
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      if (d.name || d.phone || d.plate) {
        setName(d.name);
        setPhone(d.phone);
        setPlate(d.plate);
        setRestored(true);
      }
      if (isLocale(d.language) && d.language !== locale) setLocale(d.language);
      if (d.cameraOpenedAt) {
        // the camera was opened and the page came back from the dead
        setRestarted(true);
        logClient('photo.page_restarted_during_capture', { msAway: Date.now() - d.cameraOpenedAt, step: d.step }, 'warn');
        saveDraft({ cameraOpenedAt: undefined });
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  // ---- keep the draft up to date while typing (step 1) ----
  useEffect(() => {
    if (!hydrated || photoStep) return;
    saveDraft({ name, phone, plate, language: locale, step: 'details' });
  }, [hydrated, photoStep, name, phone, plate, locale]);

  // already has a photo (e.g. came back to this page later): nothing left to do here
  useEffect(() => {
    if (photoStep && boda?.photo_url && !photoDone) {
      clearDraft();
      router.replace('/boda');
    }
  }, [photoStep, boda?.photo_url, photoDone, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== pin2) return setError(t('pinMismatch'));
    setBusy(true);
    try {
      const form = new FormData();
      form.set('name', name);
      form.set('phone', phone);
      form.set('plate', plate);
      form.set('pin', pin);
      form.set('language', locale); // the language picked at first launch is attached to the account
      await finish(await postApi('/api/auth/boda/register', form), null);
      // the account exists: forget the personal data, remember only the step
      setPin('');
      setPin2('');
      saveDraft({ name: '', phone: '', plate: '', step: 'photo' });
      setBusy(false);
    } catch (err) {
      logClient('register.failed', { code: err instanceof Error ? err.message : 'unknown' }, 'warn');
      setError(errMsg(err));
      setBusy(false);
    }
  }

  function leave() {
    clearDraft();
    router.replace('/boda');
  }

  if (loading || !hydrated) return (<><AppHeader title={t('bodaRegisterTitle')} /><Loading /></>);

  // ---------------- step 2: photo ----------------
  if (photoStep) {
    return (
      <>
        <AppHeader title={t('photoStepTitle')} />
        <Page>
          <Banner kind="success">{t('accountCreated')}</Banner>
          {restarted && !photoDone && <Banner kind="warn">{t('photoRestarted')}</Banner>}
          <PhotoUploader
            currentUrl={boda?.photo_url}
            onBeforeCamera={() => saveDraft({ step: 'photo', cameraOpenedAt: Date.now() })}
            onCaptureDone={() => saveDraft({ cameraOpenedAt: undefined })}
            onUploaded={() => {
              setPhotoDone(true);
              setRestarted(false);
              void refresh();
            }}
          />
          {photoDone ? (
            <Button size="lg" className="w-full" onClick={leave}>{t('photoContinue')}</Button>
          ) : (
            <Button variant="ghost" className="w-full" onClick={leave}>{t('photoLater')}</Button>
          )}
        </Page>
      </>
    );
  }

  // ---------------- step 1: details ----------------
  return (
    <>
      <AppHeader title={t('bodaRegisterTitle')} backHref="/boda/login" />
      <Page>
        <Banner kind="info">{t('bodaRegisterIntro')}</Banner>
        {restored && <Banner kind="warn">{t('draftRestored')}</Banner>}
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
