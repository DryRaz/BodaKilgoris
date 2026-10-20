import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError } from '@/lib/server/auth';

const BUCKET = 'boda-photos';
const MAX_PHOTO_BYTES = 1_000_000; // bucket limit is 1 MB; the browser sends ~100-200 KB

function imageKind(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * Adds or replaces the signed-in Boda's photo. Registration no longer carries a photo: the account
 * exists first, so a crash around the camera can never lose it. The file goes to Supabase Storage;
 * only its public URL is stored in the database.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('not_authenticated', 401);

  const form = await request.formData().catch((e) => {
    console.error(JSON.stringify({ client_event: 'photo.route_bad_form', userId: user.id, error: String(e) }));
    return null;
  });
  const photo = form?.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return jsonError('photo_required');
  if (photo.size > MAX_PHOTO_BYTES) return jsonError('photo_too_large');
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return jsonError('photo_required');

  const admin = createSupabaseAdminClient();
  const { data: boda } = await admin.from('boda_profiles').select('photo_url').eq('user_id', user.id).maybeSingle();
  if (!boda) return jsonError('not_a_boda', 403);

  // a new name per upload: the old file is cached for a year by the CDN, a replaced photo must show up
  const path = `${user.id}-${Date.now()}.${kind.ext}`;
  let uploadErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: true, cacheControl: '31536000' });
    uploadErr = res.error;
    if (!uploadErr) break;
  }
  if (uploadErr) {
    console.error(JSON.stringify({ client_event: 'photo.storage_upload_failed', userId: user.id, bytes: bytes.length, error: uploadErr.message }));
    return jsonError('photo_upload_failed', 502);
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const { error: updateErr } = await admin.from('boda_profiles').update({ photo_url: pub.publicUrl }).eq('user_id', user.id);
  if (updateErr) {
    console.error(JSON.stringify({ client_event: 'photo.db_update_failed', userId: user.id, error: updateErr.message }));
    await admin.storage.from(BUCKET).remove([path]); // do not leave an orphan behind
    return jsonError('photo_upload_failed', 500);
  }

  // best effort: drop the previous file
  const previous = boda.photo_url?.split(`/${BUCKET}/`)[1];
  if (previous && previous !== path) await admin.storage.from(BUCKET).remove([previous]).catch(() => {});

  return NextResponse.json({ ok: true, photo_url: pub.publicUrl });
}
