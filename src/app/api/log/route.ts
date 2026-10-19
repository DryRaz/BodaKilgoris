import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_BODY = 4_000;
const LEVELS = new Set(['info', 'warn', 'error']);

/**
 * Receives client-side diagnostics (camera / upload failures, page restarts) and writes them as
 * one JSON line to the server log (Vercel > Logs, search "client_event"). Intentionally stores
 * nothing in the database and accepts nothing but short codes: it is a trail, not a data sink.
 */
export async function POST(request: Request) {
  const text = await request.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return new NextResponse(null, { status: 204 });
  let body: { event?: unknown; level?: unknown; detail?: unknown; at?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const event = typeof body.event === 'string' ? body.event.slice(0, 80) : 'unknown';
  const level = typeof body.level === 'string' && LEVELS.has(body.level) ? body.level : 'error';

  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    userId = (await supabase.auth.getSession()).data.session?.user.id ?? null; // cookie read only, no network
  } catch {
    /* anonymous */
  }

  const line = JSON.stringify({
    client_event: event,
    userId,
    detail: body.detail && typeof body.detail === 'object' ? body.detail : null,
    at: typeof body.at === 'string' ? body.at.slice(0, 40) : null,
    ua: request.headers.get('user-agent')?.slice(0, 200) ?? null,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  return new NextResponse(null, { status: 204 });
}
