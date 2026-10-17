import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/server/auth';
import { logError } from '@/lib/server/log';
import { saveBodaPhoto } from '@/lib/server/photo';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** A signed-in Boda adds or changes their own photo (after registration, from the dashboard / settings). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('not_authenticated', 401);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'boda') return jsonError('not_a_boda', 403);

  const form = await request.formData().catch(() => null);
  const url = await saveBodaPhoto(admin, user.id, form?.get('photo') ?? null, { route: 'boda/photo' });
  if (!url) return jsonError('photo_failed', 400);

  const { error } = await admin.from('boda_profiles').update({ photo_url: url }).eq('user_id', user.id);
  if (error) {
    logError('boda/photo:update', error, { route: 'boda/photo' });
    return jsonError('generic', 500);
  }
  return NextResponse.json({ ok: true, photo_url: url });
}
