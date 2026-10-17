import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logError } from './log';

export const MAX_PHOTO_BYTES = 1_000_000; // bucket limit is 1 MB; the browser compresses to ~100 KB first

export function imageKind(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * The photo is strongly recommended but NEVER blocks an account. Returns the public URL, or null
 * when there is no (valid) photo / the upload failed. The reason is logged, not thrown.
 */
export async function saveBodaPhoto(
  admin: SupabaseClient,
  userId: string,
  file: FormDataEntryValue | null,
  ctx: Record<string, unknown> = {},
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) {
    logError('photo:too-large', { message: `photo of ${file.size} bytes ignored` }, ctx);
    return null;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) {
    logError('photo:not-an-image', { message: 'photo ignored: not jpeg/png/webp' }, ctx);
    return null;
  }
  const path = `${userId}.${kind.ext}`;
  const { error } = await admin.storage
    .from('boda-photos')
    .upload(path, bytes, { contentType: kind.mime, upsert: true, cacheControl: '31536000' });
  if (error) {
    logError('photo:upload', error, ctx);
    return null;
  }
  const { data } = admin.storage.from('boda-photos').getPublicUrl(path);
  // same path is reused on a change of photo: bust the browser/CDN cache
  return `${data.publicUrl}?v=${Date.now()}`;
}
