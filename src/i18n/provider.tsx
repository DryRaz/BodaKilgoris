'use client';

import { NextIntlClientProvider } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, intlLocale, isLocale, type Locale } from './config';
import { allMessages } from './messages';

interface LocaleContextValue {
  locale: Locale;
  /** false until the user picked a language at least once (first launch). */
  chosen: boolean;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocaleContext must be used inside <I18nProvider>');
  return ctx;
}

function persist(locale: Locale) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode: the in-memory choice still works for this visit */
  }
  document.documentElement.lang = locale;
}

/**
 * Both message files are bundled (a few KB each), so switching language is a plain
 * React state change: no reload, no navigation, no re-login.
 */
export function I18nProvider({
  initialLocale,
  initialChosen,
  children,
}: {
  initialLocale: Locale;
  initialChosen: boolean;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [chosen, setChosen] = useState(initialChosen);

  // Cookie lost but localStorage still there (or the other way round)
  useEffect(() => {
    if (initialChosen) return;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) {
        setLocaleState(stored);
        setChosen(true);
        persist(stored);
      }
    } catch {
      /* ignore */
    }
  }, [initialChosen]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setChosen(true);
    persist(next);
  }, []);

  const value = useMemo(() => ({ locale, chosen, setLocale }), [locale, chosen, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={intlLocale[locale]} messages={allMessages[locale]} timeZone="Africa/Nairobi">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
