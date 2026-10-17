'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AppHeader, Page } from '@/components/app-header';
import { PhotoPicker } from '@/components/photo-picker';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Field, PinInput, TextInput } from '@/components/ui';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useFinishLogin } from '@/hooks/useFinishLogin';
import { useRegistrationDraft } from '@/hooks/useRegistrationDraft';
import { useLocaleContext } from '@/i18n/provider';
import { postApi } from '@/lib/api';

export default function BodaRegisterPage() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const errMsg = useErrorMessage();
  const finish = useFinishLogin();
  const toast = useToast();
  const { locale } = useLocaleContext();
  const { draft, update, photo, setPhoto, restored, clear } = useRegistrationDraft();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(false);
  const nudgeRef = useRef<HTMLDivElement>(null);

  // the reminder appears below the PIN fields: bring it into view
  useEffect(() => {
    if (nudge) nudgeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [nudge]);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('name', draft.name);
      form.set('phone', draft.phone);
      form.set('plate', draft.plate);
      form.set('pin', draft.pin);
      form.set('language', locale); // the language picked at first launch is attached to the account
      if (photo) form.set('photo', photo);
      const res = await postApi('/api/auth/boda/register', form);
      clear();
      if (photo && res.photo === false) toast.show(te('photo_failed'), 'info');
      await finish(res, '/boda');
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (draft.pin !== draft.pin2) return setError(t('pinMismatch'));
    // The photo is strongly recommended, never mandatory: ask once, then let them go on without it
    if (!photo && !nudge) return setNudge(true);
    void register();
  }

  return (
    <>
      <AppHeader title={t('bodaRegisterTitle')} backHref="/boda/login" />
      <Page>
        <Banner kind="info">{t('bodaRegisterIntro')}</Banner>
        {restored && <Banner kind="success">{t('draftRestored')}</Banner>}
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('name')}>
            {(id) => <TextInput id={id} value={draft.name} onChange={(e) => update({ name: e.target.value })} autoComplete="name" maxLength={60} />}
          </Field>
          <Field label={t('phone')} hint={t('phoneHint')}>
            {(id) => <TextInput id={id} value={draft.phone} onChange={(e) => update({ phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" />}
          </Field>
          <Field label={t('plate')} hint={t('plateHint')}>
            {(id) => <TextInput id={id} value={draft.plate} onChange={(e) => update({ plate: e.target.value.toUpperCase() })} autoCapitalize="characters" maxLength={15} />}
          </Field>
          <Field label={`${t('photo')} (${t('photoRecommendedTag')})`} hint={t('photoRecommended')}>
            {() => (
              <PhotoPicker
                value={photo}
                onChange={(f) => {
                  setPhoto(f);
                  if (f) setNudge(false);
                }}
                showHint={false}
              />
            )}
          </Field>
          <Field label={t('pin')} hint={t('pinHint')}>{(id) => <PinInput id={id} value={draft.pin} onChange={(v) => update({ pin: v })} autoComplete="new-password" />}</Field>
          <Field label={t('pinConfirm')}>{(id) => <PinInput id={id} value={draft.pin2} onChange={(v) => update({ pin2: v })} autoComplete="new-password" />}</Field>

          {nudge && !photo && (
            <div ref={nudgeRef}>
            <Card className="space-y-3 border-2 border-accent-400 bg-warn-50">
              <p className="text-lg font-extrabold">📷 {t('photoNudgeTitle')}</p>
              <p className="text-base">{t('photoNudgeBody')}</p>
              <p className="text-sm text-muted">{t('photoRecommended')}</p>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => document.querySelector<HTMLInputElement>('input[data-photo-camera]')?.click()}
              >
                📷 {t('photoNudgeAdd')}
              </Button>
              <Button variant="ghost" className="w-full" loading={busy} onClick={() => void register()}>
                {t('photoNudgeSkip')}
              </Button>
            </Card>
            </div>
          )}

          {error && <Banner kind="error">{error}</Banner>}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy && !nudge}
            disabled={!draft.name || !draft.phone || !draft.plate || draft.pin.length !== 4 || draft.pin2.length !== 4}
          >
            {t('register')}
          </Button>
        </form>
        <Link href="/boda/login" className="block py-2 text-center font-bold text-brand-700">{t('haveAccount')}</Link>
      </Page>
    </>
  );
}
