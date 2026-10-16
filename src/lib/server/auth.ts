import 'server-only';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isLocale } from '@/i18n/config';

function pepper(): string {
  const p = process.env.AUTH_PEPPER;
  if (!p || p.length < 16) throw new Error('AUTH_PEPPER is missing or too short (use `openssl rand -hex 32`)');
  return p;
}

/**
 * Supabase Auth needs an email + password. Bodas and clients only know a phone number
 * (+ a 4-digit PIN for Bodas), so we derive both:
 *   email    = <digits>@users.bodakilgoris.app   (never shown, never mailed)
 *   password = HMAC-SHA256(AUTH_PEPPER, "<kind>:<phone>:<secret>")
 * The PIN is therefore never the stored password, and guessing it online is
 * rate-limited by profiles.pin_failed_attempts / pin_locked_until.
 */
export function emailForPhone(phone: string): string {
  return `${phone.replace(/\D/g, '')}@users.bodakilgoris.app`;
}

export function bodaPassword(phone: string, pin: string): string {
  return createHmac('sha256', pepper()).update(`boda:${phone}:${pin}`).digest('hex');
}

export function clientPassword(phone: string): string {
  return createHmac('sha256', pepper()).update(`client:${phone}`).digest('hex');
}

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

/**
 * The cookies are already set by the server client. The browser client also needs the
 * tokens so its in-memory session (and the Realtime socket) switch from anon to the user
 * right away, without a page reload.
 */
export function sessionTokens(session: { access_token: string; refresh_token: string } | null) {
  return session ? { access_token: session.access_token, refresh_token: session.refresh_token } : null;
}

export function jsonError(code: string, status = 400) {
  return NextResponse.json({ ok: false, error: code }, { status });
}

export function pickLanguage(value: unknown): string {
  return isLocale(value) ? value : 'en';
}

/** Returns the signed-in admin, or null. Never trusts anything but the verified session. */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin' ? { user, supabase, admin } : null;
}
