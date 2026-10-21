export const ALERT_CATEGORIES = ['alcohol', 'tobacco_drugs', 'health', 'money', 'danger', 'insult'] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export const ALERT_STATUSES = ['new', 'seen', 'handled', 'dismissed'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Badge colours: readable on a low-end screen in sunlight (dark text on a light fill). */
export const CATEGORY_CLASS: Record<AlertCategory, string> = {
  alcohol: 'bg-[#fde8c8] text-[#7a3e00]',
  tobacco_drugs: 'bg-[#e7dcf7] text-[#4a2a86]',
  health: 'bg-[#d6ecf7] text-[#0b4a6b]',
  money: 'bg-[#d9f2dc] text-[#14602a]',
  danger: 'bg-[#fbd9d9] text-[#8a1212]',
  insult: 'bg-[#e6e6e6] text-[#333]',
};

export interface AlertRow {
  id: string;
  created_at: string;
  category: AlertCategory;
  source: 'item' | 'client_note';
  matched_text: string | null;
  status: AlertStatus;
  admin_note: string | null;
  handled_at: string | null;
  ride_id: string;
  ride_type: string | null;
  ride_status: string | null;
  client_id: string;
  client_name: string | null;
  client_phone: string | null;
  term: string | null;
  recent_count: number;
}

export interface ClientAlertGroup {
  client_id: string;
  client_name: string | null;
  client_phone: string | null;
  total: number;
  new_count: number;
  last_at: string;
  by_category: Partial<Record<AlertCategory, number>> | null;
}

export interface AlertTerm { id: string; term: string; category: AlertCategory; alert_enabled: boolean; active: boolean }
export interface AlertSettings {
  alerts_enabled: number;
  retention_days: number;
  categories: Record<AlertCategory, number>;
  terms: AlertTerm[];
  daily_counts: Partial<Record<AlertCategory, number>>;
}
export interface AlertTestResult {
  alerts_enabled: boolean;
  would_alert: boolean;
  matches: { term: string; category: AlertCategory; term_alert: boolean; term_active: boolean; category_alert: boolean; would_alert: boolean }[];
}

/** Never swallow a Supabase error: message, code, details and hint all go to the console. */
export function logSupabaseError(context: string, error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined) {
  if (!error) return;
  console.error(`[alerts] ${context}`, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

export const telHref = (phone: string) => `tel:${phone.startsWith('+') ? phone : `+${phone}`}`;
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
