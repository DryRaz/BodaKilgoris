import { NextResponse } from 'next/server';
import { isValidPin } from '@/lib/phone';
import { bodaPassword, jsonError, requireAdmin } from '@/lib/server/auth';

/** A Boda forgot their PIN: the admin sets a new one and unlocks the account. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return jsonError('forbidden', 403);

  const body = await request.json().catch(() => null);
  const bodaId = String(body?.bodaId ?? '');
  const pin = body?.pin;
  if (!isValidPin(pin)) return jsonError('invalid_pin');

  const { data: profile } = await ctx.admin
    .from('profiles').select('id, phone, role').eq('id', bodaId).maybeSingle();
  if (!profile || profile.role !== 'boda' || !profile.phone) return jsonError('not_found', 404);

  const { error } = await ctx.admin.auth.admin.updateUserById(profile.id, {
    password: bodaPassword(profile.phone, pin),
  });
  if (error) return jsonError('generic', 500);
  await ctx.admin.from('profiles').update({ pin_failed_attempts: 0, pin_locked_until: null }).eq('id', profile.id);
  return NextResponse.json({ ok: true });
}
