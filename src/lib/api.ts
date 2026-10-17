import { getSupabase } from '@/lib/supabase/client';

export interface ApiOk { ok: true; language?: string; photo?: boolean; session?: { access_token: string; refresh_token: string } | null }
export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** POST JSON or FormData to one of our API routes. Throws ApiError(code) on failure. */
export async function postApi(url: string, body: Record<string, unknown> | FormData): Promise<ApiOk> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (ApiOk | { ok: false; error: string }) | null;
  if (!res.ok || !json || !json.ok) throw new ApiError((json && 'error' in json && json.error) || 'generic');
  return json;
}

/** Hands the freshly created server session to the browser client. */
export async function adoptSession(session: ApiOk['session']) {
  if (!session) return;
  await getSupabase().auth.setSession(session);
}
