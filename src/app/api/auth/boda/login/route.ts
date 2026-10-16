import { NextResponse } from 'next/server';
import { normalizePhone, isValidPin } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  bodaPassword, emailForPhone, jsonError, MAX_PIN_ATTEMPTS, PIN_LOCK_MINUTES, sessionTokens,
} from '@/lib/server/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  const pin = body?.pin;
  if (!phone) return jsonError('invalid_phone');
  if (!isValidPin(pin)) return jsonError('invalid_pin');

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, language, pin_failed_attempts, pin_locked_until')
    .eq('phone', phone)
    .maybeSingle();

  // same answer for "unknown number" and "wrong PIN": no account enumeration
  if (!profile || profile.role !== 'boda') return jsonError('invalid_credentials', 401);

  if (profile.pin_locked_until && new Date(profile.pin_locked_until) > new Date()) {
    return jsonError('too_many_attempts', 429);
  }

  const supabase = await createSupabaseServerClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
  });

  if (error) {
    const attempts = (profile.pin_failed_attempts ?? 0) + 1;
    const lock = attempts >= MAX_PIN_ATTEMPTS;
    await admin
      .from('profiles')
      .update({
        pin_failed_attempts: lock ? 0 : attempts,
        pin_locked_until: lock ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq('id', profile.id);
    return jsonError(lock ? 'too_many_attempts' : 'invalid_credentials', lock ? 429 : 401);
  }

  if (profile.pin_failed_attempts || profile.pin_locked_until) {
    await admin.from('profiles').update({ pin_failed_attempts: 0, pin_locked_until: null }).eq('id', profile.id);
  }
  return NextResponse.json({ ok: true, language: profile.language, session: sessionTokens(signedIn.session) });
}
