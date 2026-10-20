import { jsonError, requireAdmin } from '@/lib/server/auth';

const COLUMNS = [
  'id', 'type', 'requested_at', 'requested_at_nairobi', 'status', 'counted', 'suspect', 'suspect_reason',
  'client_confirmed', 'boda_confirmed', 'auto_confirmed', 'accepted_at', 'arrived_at', 'completed_at',
  'accept_delay_seconds', 'ride_minutes', 'agreed_price_kes', 'rating', 'cancelled_by',
  'client_name', 'client_phone', 'boda_name', 'boda_plate', 'boda_phone',
  'destination_text', 'destination_lat', 'destination_lng', 'pickup_lat', 'pickup_lng', 'pickup_note',
  'items_count', 'budget_max_kes', 'items_total_kes', 'delivery_fee_kes', 'receipts_kept', 'receipts_shown',
  'delivery_landmark', 'problem_reported', 'problem_type', 'problem_text',
] as const;

const nairobi = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = Array.isArray(value) ? value.join('|') : String(value);
  // neutralise spreadsheet formula injection (names / destinations are user-typed)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return jsonError('forbidden', 403);

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const onlyCounted = url.searchParams.get('counted') === '1';
  const onlySuspect = url.searchParams.get('suspect') === '1';

  const rows: Record<string, unknown>[] = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 100_000; offset += PAGE) {
    let q = ctx.supabase.from('rides').select('*').order('requested_at', { ascending: false });
    // dates are Nairobi calendar days (UTC+3, no DST)
    if (isDate(from)) q = q.gte('requested_at', `${from}T00:00:00+03:00`);
    if (isDate(to)) q = q.lte('requested_at', `${to}T23:59:59.999+03:00`);
    if (onlyCounted) q = q.eq('counted', true);
    if (onlySuspect) q = q.eq('suspect', true);
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) return jsonError('generic', 500);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // Shopping orders drop the client's phone from the order row once they end; the admin still gets it from the profile.
  const phones = new Map<string, string>();
  const ids = [...new Set(rows.flatMap((r) => [r.client_id, r.boda_id] as string[]))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await ctx.supabase.from('profiles').select('id, phone').in('id', ids.slice(i, i + 200));
    for (const p of data ?? []) if (p.phone) phones.set(p.id as string, p.phone as string);
  }

  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    const acceptedAt = r.accepted_at ? Date.parse(r.accepted_at as string) : null;
    const completedAt = r.completed_at ? Date.parse(r.completed_at as string) : null;
    const derived: Record<string, unknown> = {
      ...r,
      client_phone: r.client_phone ?? (r.type === 'shopping' && r.accepted_at ? phones.get(r.client_id as string) : '') ?? '',
      requested_at_nairobi: nairobi.format(new Date(r.requested_at as string)),
      accept_delay_seconds: acceptedAt ? Math.round((acceptedAt - Date.parse(r.requested_at as string)) / 1000) : '',
      ride_minutes: acceptedAt && completedAt ? ((completedAt - acceptedAt) / 60000).toFixed(1) : '',
    };
    lines.push(COLUMNS.map((c) => cell(derived[c])).join(','));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rides-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
