import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Public entry points of each area; everything else under the prefix needs a session.
const PUBLIC = new Set(['/boda/login', '/boda/register', '/client/start', '/admin/login']);

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { supabase, user, getResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin') && !PUBLIC.has(path)) {
    if (!user) return redirectTo(request, '/admin/login');
    // the role check is repeated by RLS (is_admin()) on every query — this is only the door
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (data?.role !== 'admin') return redirectTo(request, '/admin/login');
  } else if (path.startsWith('/boda') && !PUBLIC.has(path) && !user) {
    return redirectTo(request, '/boda/login');
  } else if (path.startsWith('/client') && !PUBLIC.has(path) && !user) {
    return redirectTo(request, '/client/start');
  }

  return getResponse();
}

export const config = {
  matcher: [
    // skip static assets, the service worker, the manifest and icons
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|offline.html|api/).*)',
  ],
};
