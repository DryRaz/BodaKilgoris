// To add a language (e.g. French):
//   1. add its code here + its native name below
//   2. create messages/fr.json (same keys as en.json — `npm run i18n:check` verifies)
//   3. import it in src/i18n/messages.ts
//   4. INSERT INTO supported_languages (code, label) VALUES ('fr', 'Français');
export const locales = ['en', 'sw'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Always shown in their own language so anyone can find theirs. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  sw: 'Kiswahili',
};

/** BCP-47 tag used for number/date formatting (Kenyan conventions). */
export const intlLocale: Record<Locale, string> = {
  en: 'en-KE',
  sw: 'sw-KE',
};

export const LOCALE_COOKIE = 'lang';
export const LOCALE_STORAGE_KEY = 'boda.lang';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
