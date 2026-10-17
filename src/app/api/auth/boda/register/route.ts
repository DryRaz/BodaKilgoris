import { NextResponse } from 'next/server';
import { normalizePhone, normalizePlate, isValidPin } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bodaPassword, emailForPhone, jsonError, pickLanguage, sessionTokens } from '@/lib/server/auth';
import { logError, maskPhone } from '@/lib/server/log';
import { saveBodaPhoto } from '@/lib/server/photo';

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError('generic');

  const name = String(form.get('name') ?? '').trim();
  const phone = normalizePhone(form.get('phone'));
  const plate = normalizePlate(form.get('plate'));
  const pin = form.get('pin');
  const language = pickLanguage(form.get('language'));
  const photo = form.get('photo');

  if (name.length < 2 || name.length > 60) return jsonError('invalid_name');
  if (!phone) return jsonError('invalid_phone');
  if (!plate) return jsonError('invalid_plate');
  if (!isValidPin(pin)) return jsonError('invalid_pin');

  const admin = createSupabaseAdminClient();
  const ctx = { route: 'boda/register', phone: maskPhone(phone) };

  const { data: existing, error: lookupErr } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (lookupErr) logError('boda/register:lookup-profile', lookupErr, ctx);
  if (existing) return jsonError('phone_in_use', 409);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
    email_confirm: true,
  });
  if (createErr || !created.user) {
    logError('boda/register:create-user', createErr, ctx);
    return jsonError(createErr?.status === 422 ? 'phone_in_use' : 'generic', 500);
  }
  const userId = created.user.id;
  const rollback = async (code: string, status = 500) => {
    await admin.auth.admin.deleteUser(userId); // cascades to profile + boda_profile
    return jsonError(code, status);
  };

  const { error: profileErr } = await admin
    .from('profiles')
    .insert({ id: userId, role: 'boda', name, phone, language });
  if (profileErr) logError('boda/register:insert-profile', profileErr, ctx);
  if (profileErr) return rollback(profileErr.code === '23505' ? 'phone_in_use' : 'generic', profileErr.code === '23505' ? 409 : 500);

  const { error: bodaErr } = await admin.from('boda_profiles').insert({ user_id: userId, plate });
  if (bodaErr) logError('boda/register:insert-boda-profile', bodaErr, ctx);
  if (bodaErr) return rollback(bodaErr.code === '23505' ? 'plate_in_use' : 'generic', bodaErr.code === '23505' ? 409 : 500);

  // The photo is strongly recommended but must never block the account: a failure here is
  // logged and reported to the app (photo: false) so it can offer to retry later.
  const photoUrl = await saveBodaPhoto(admin, userId, photo, ctx);
  if (photoUrl) await admin.from('boda_profiles').update({ photo_url: photoUrl }).eq('user_id', userId);

  const supabase = await createSupabaseServerClient();
  const { data: signedIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
  });
  if (signInErr) {
    logError('boda/register:sign-in', signInErr, ctx);
    return jsonError('generic', 500);
  }

  return NextResponse.json({
    ok: true,
    photo: !!photoUrl,
    session: sessionTokens(signedIn.session),
  });
}
