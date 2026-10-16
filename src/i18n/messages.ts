import en from '../../messages/en.json';
import sw from '../../messages/sw.json';
import type { Locale } from './config';

export type Messages = typeof en;
export const allMessages: Record<Locale, Messages> = { en, sw };
