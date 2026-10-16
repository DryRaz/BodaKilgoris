import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientPassword, emailForPhone, jsonError, pickLanguage, sessionTokens } from '@/lib/server/auth';
import { logError, maskPhone } from '@/lib/server/log';

/**
 * Clients have no password (by design for phase 1): name + phone creates the account,
 * and the same phone on another device signs into it. The risk is limited to someone
 * requesting rides under that name; a client never sees other people's data (RLS).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const phone = normalizePhone(body?.phone);
  const language = pickLanguage(body?.language);

  if (!phone) return jsonError('invalid_phone');

  const admin = createSupabaseAdminClient();
  const ctx = { route: 'client/start', phone: maskPhone(phone) };
  const { data: existing, error: lookupErr } = await admin.from('profiles').select('id, role, language').eq('phone', phone).maybeSingle();
  if (lookupErr) logError('client/start:lookup-profile', lookupErr, ctx);

  if (existing) {
    if (existing.role !== 'client') return jsonError('role_mismatch', 409);
  } else {
    if (name.length < 2 || name.length > 60) return jsonError('invalid_name');
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailForPhone(phone),
      password: clientPassword(phone),
      email_confirm: true,
    });
    if (createErr || !created.user) {
      logError('client/start:create-user', createErr, ctx);
      return jsonError('generic', 500);
    }
    const { error: profileErr } = await admin
      .from('profiles')
      .insert({ id: created.user.id, role: 'client', name, phone, language });
    if (profileErr) {
      logError('client/start:insert-profile', profileErr, ctx);
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonError(profileErr.code === '23505' ? 'phone_in_use' : 'generic', 500);
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password: clientPassword(phone),
  });
  if (error) {
    logError('client/start:sign-in', error, ctx);
    return jsonError('generic', 500);
  }

  return NextResponse.json({
    ok: true,
    language: existing?.language ?? language,
    session: sessionTokens(signedIn.session),
  });
}
