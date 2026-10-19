import { NextResponse } from 'next/server';
import { normalizePhone, normalizePlate, isValidPin } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bodaPassword, emailForPhone, jsonError, pickLanguage, sessionTokens } from '@/lib/server/auth';

/**
 * Creates the account WITHOUT a photo and signs the Boda in. The photo is added afterwards via
 * POST /api/boda/photo (optional step), so a crash around the camera never loses the registration.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError('generic');

  const name = String(form.get('name') ?? '').trim();
  const phone = normalizePhone(form.get('phone'));
  const plate = normalizePlate(form.get('plate'));
  const pin = form.get('pin');
  const language = pickLanguage(form.get('language'));

  if (name.length < 2 || name.length > 60) return jsonError('invalid_name');
  if (!phone) return jsonError('invalid_phone');
  if (!plate) return jsonError('invalid_plate');
  if (!isValidPin(pin)) return jsonError('invalid_pin');

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (existing) return jsonError('phone_in_use', 409);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
    email_confirm: true,
  });
  if (createErr || !created.user) return jsonError(createErr?.status === 422 ? 'phone_in_use' : 'generic', 500);
  const userId = created.user.id;
  const rollback = async (code: string, status = 500) => {
    console.error(JSON.stringify({ client_event: 'register.rolled_back', code, userId }));
    await admin.auth.admin.deleteUser(userId); // cascades to profile + boda_profile
    return jsonError(code, status);
  };

  const { error: profileErr } = await admin
    .from('profiles')
    .insert({ id: userId, role: 'boda', name, phone, language });
  if (profileErr) return rollback(profileErr.code === '23505' ? 'phone_in_use' : 'generic', profileErr.code === '23505' ? 409 : 500);

  const { error: bodaErr } = await admin.from('boda_profiles').insert({ user_id: userId, plate });
  if (bodaErr) return rollback(bodaErr.code === '23505' ? 'plate_in_use' : 'generic', bodaErr.code === '23505' ? 409 : 500);

  const supabase = await createSupabaseServerClient();
  const { data: signedIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
  });
  if (signInErr) {
    // the account exists: the Boda can still log in with the PIN he just chose
    console.error(JSON.stringify({ client_event: 'register.signin_failed', userId, error: signInErr.message }));
    return jsonError('generic', 500);
  }

  return NextResponse.json({ ok: true, session: sessionTokens(signedIn.session) });
}
