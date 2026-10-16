import { NextResponse } from 'next/server';
import { normalizePhone, normalizePlate, isValidPin } from '@/lib/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bodaPassword, emailForPhone, jsonError, pickLanguage, sessionTokens } from '@/lib/server/auth';
import { logError, maskPhone } from '@/lib/server/log';

const MAX_PHOTO_BYTES = 1_000_000; // bucket limit is 1 MB; the browser compresses to ~150 KB first

function imageKind(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

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
  if (!(photo instanceof File) || photo.size === 0) return jsonError('photo_required');
  if (photo.size > MAX_PHOTO_BYTES) return jsonError('photo_too_large');
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return jsonError('photo_required');

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

  const path = `${userId}.${kind.ext}`;
  const { error: uploadErr } = await admin.storage
    .from('boda-photos')
    .upload(path, bytes, { contentType: kind.mime, upsert: true, cacheControl: '31536000' });
  if (uploadErr) {
    logError('boda/register:photo-upload', uploadErr, ctx);
    return rollback('generic');
  }
  const { data: pub } = admin.storage.from('boda-photos').getPublicUrl(path);
  await admin.from('boda_profiles').update({ photo_url: pub.publicUrl }).eq('user_id', userId);

  const supabase = await createSupabaseServerClient();
  const { data: signedIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: emailForPhone(phone),
    password: bodaPassword(phone, pin),
  });
  if (signInErr) {
    logError('boda/register:sign-in', signInErr, ctx);
    return jsonError('generic', 500);
  }

  return NextResponse.json({ ok: true, session: sessionTokens(signedIn.session) });
}
