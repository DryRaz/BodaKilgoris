import { ApiError } from '@/lib/api';
import { errMessage, logClient } from '@/lib/clientlog';

const ATTEMPTS = 3;
const TIMEOUT_MS = 40_000; // slow 2G/3G: a 150 KB photo can take a while
/** Server answers that retrying cannot fix. */
const FINAL = new Set(['photo_required', 'photo_too_large', 'not_authenticated', 'not_a_boda', 'forbidden']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uploads the (already compressed) photo to /api/boda/photo, which stores it in Supabase Storage
 * and links it to the Boda. Retries network failures and 5xx with a growing pause; the caller keeps
 * the File so a final failure can be retried with one tap, without taking a new picture.
 */
export async function uploadBodaPhoto(file: File): Promise<{ photoUrl: string }> {
  let last: unknown = new ApiError('generic');
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let fatal: ApiError | null = null;
    try {
      const form = new FormData();
      form.set('photo', file);
      const res = await fetch('/api/boda/photo', { method: 'POST', body: form, signal: ctrl.signal });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; photo_url?: string } | null;
      if (res.ok && json?.ok && json.photo_url) return { photoUrl: json.photo_url };
      const code = json?.error ?? 'generic';
      logClient('photo.upload_rejected', { attempt, status: res.status, code, bytes: file.size });
      last = new ApiError(code);
      if (FINAL.has(code) || (res.status >= 400 && res.status < 500)) fatal = last as ApiError;
    } catch (err) {
      last = err; // network down, timeout (abort), dropped connection: worth another try
      logClient('photo.upload_failed', { attempt, bytes: file.size, error: errMessage(err), aborted: ctrl.signal.aborted });
    } finally {
      clearTimeout(timer);
    }
    if (fatal) throw fatal;
    if (attempt < ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1)); // 1 s, 2 s
  }
  throw last;
}
