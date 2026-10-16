import type { Messages } from './i18n/messages';

// Typed translation keys: a typo in t('boda.avalable') fails `tsc`.
declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
