import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonError, sessionTokens } from '@/lib/server/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!email || !password) return jsonError('invalid_admin_credentials', 401);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return jsonError('invalid_admin_credentials', 401);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, language').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return jsonError('invalid_admin_credentials', 401);
  }
  return NextResponse.json({ ok: true, language: profile.language, session: sessionTokens(data.session) });
}
