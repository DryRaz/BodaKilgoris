import type { Locale } from '@/i18n/config';
import type { RideItem } from './types';

/** Known catalogue categories, in display order. A category the admin invents is shown after them, under its own key. */
export const CATEGORY_ORDER = ['staples', 'fresh', 'home', 'energy', 'misc'] as const;
/** Units the admin can pick (labels live in messages: shopping.units.*). */
export const UNITS = ['kg', 'litre', 'piece', 'packet', 'sachet', 'bunch', 'ksh'] as const;
/** Airtime is bought in KSh: the +/- buttons move in steps of 50. Every other unit moves by 1. */
const UNIT_STEP: Record<string, number> = { ksh: 50 };
export const unitStep = (unit?: string | null) => UNIT_STEP[unit ?? ''] ?? 1;
export const MAX_QUANTITY = 10_000;

type Named = { name_en?: string | null; name_sw?: string | null; custom_name?: string | null };
/** The article's name in the reader's language (free-text articles are shown as typed). */
export function itemLabel(item: Named, locale: Locale): string {
  if (item.custom_name) return item.custom_name;
  return (locale === 'sw' ? item.name_sw : item.name_en) || item.name_en || item.name_sw || '';
}

/** One line of the list being written. Catalogue lines carry both names so the draft needs no re-fetch. */
export interface DraftLine {
  key: string;
  catalogId?: string;
  nameEn?: string;
  nameSw?: string;
  unit?: string;
  custom?: string;
  quantity: number;
}

export type ShoppingStep = 'list' | 'review' | 'boda';

/**
 * The shopping list lives in localStorage from the first tapped article until the order is delivered:
 * a page that reloads (low-RAM phone, camera, call...), a refusal or an expiry must never lose it.
 */
export interface ShoppingDraft {
  lines: DraftLine[];
  budget: string;
  note: string;
  landmark: string;
  step: ShoppingStep;
  /** 'shopping' = the client is inside the shopping flow; 'home' = parked on the choice screen */
  view: 'home' | 'shopping';
  /** id of the order this list was sent as (lets us forget the list once that order is finished) */
  sentRideId?: string;
  savedAt: number;
}

const KEY = 'boda.shoppingDraft.v1';
const MAX_AGE_MS = 3 * 24 * 3600_000;
export const emptyDraft = (): ShoppingDraft => ({ lines: [], budget: '', note: '', landmark: '', step: 'list', view: 'home', savedAt: Date.now() });

export function loadShoppingDraft(): ShoppingDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ShoppingDraft>;
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS || !Array.isArray(d.lines)) {
      localStorage.removeItem(KEY);
      return null;
    }
    const lines = d.lines
      .filter((l): l is DraftLine => !!l && typeof l.key === 'string' && typeof l.quantity === 'number' && (!!l.catalogId || !!l.custom))
      .map((l) => ({ ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, Math.round(l.quantity))) }));
    return {
      lines,
      budget: typeof d.budget === 'string' ? d.budget : '',
      note: typeof d.note === 'string' ? d.note : '',
      landmark: typeof d.landmark === 'string' ? d.landmark : '',
      step: d.step === 'review' || d.step === 'boda' ? d.step : 'list',
      view: d.view === 'shopping' ? 'shopping' : 'home',
      sentRideId: typeof d.sentRideId === 'string' ? d.sentRideId : undefined,
      savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveShoppingDraft(d: ShoppingDraft): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearShoppingDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The jsonb the request_shopping() function expects. */
export function draftToItems(lines: DraftLine[]) {
  return lines.map((l) => (l.catalogId ? { catalog_item_id: l.catalogId, quantity: l.quantity } : { custom_name: l.custom, quantity: l.quantity }));
}

/** Pending / done counters for a list of order lines. */
export function itemProgress(items: Pick<RideItem, 'status'>[]) {
  const pending = items.filter((i) => i.status === 'pending').length;
  return { pending, done: items.length - pending };
}
