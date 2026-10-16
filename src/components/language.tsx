'use client';

import { useTranslations } from 'next-intl';
import { useCallback, type ReactNode } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useLocaleContext } from '@/i18n/provider';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth } from './auth-provider';

/** Changes the UI language instantly and, when signed in, saves it on the account. */
export function useChangeLanguage() {
  const { setLocale } = useLocaleContext();
  const { user } = useAuth();
  return useCallback(
    (next: Locale) => {
      setLocale(next);
      if (user) void getSupabase().rpc('set_language', { p_language: next });
    },
    [setLocale, user],
  );
}

/** Two big buttons: shown before anything else on the very first launch. */
export function LanguageChooser({ onPick }: { onPick?: (l: Locale) => void }) {
  const change = useChangeLanguage();
  const t = useTranslations('language');
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-brand-600 text-5xl shadow-lg" aria-hidden>
          🏍️
        </div>
        <h1 className="text-3xl font-extrabold">Boda Kilgoris</h1>
        <p className="mt-3 text-xl font-semibold">English · Kiswahili</p>
      </div>
      <div className="space-y-4">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => {
              change(l);
              onPick?.(l);
            }}
            className="w-full rounded-3xl bg-brand-600 py-7 text-3xl font-extrabold text-white shadow-md active:bg-brand-700"
          >
            {localeNames[l]}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-muted">{t('subtitle')}</p>
    </div>
  );
}

/** Compact pills for headers / settings. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale } = useLocaleContext();
  const change = useChangeLanguage();
  const t = useTranslations('language');
  return (
    <div role="group" aria-label={t('label')} className={`inline-flex overflow-hidden rounded-full border-2 border-line bg-white ${className}`}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          onClick={() => locale !== l && change(l)}
          className={`min-h-10 px-3.5 text-sm font-bold ${locale === l ? 'bg-brand-600 text-white' : 'text-ink'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Blocks the app until a language was picked (first launch, before sign-up). */
export function LanguageGate({ children }: { children: ReactNode }) {
  const { chosen } = useLocaleContext();
  if (!chosen) return <LanguageChooser />;
  return <>{children}</>;
}
