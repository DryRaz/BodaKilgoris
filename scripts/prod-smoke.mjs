// Smoke test of a DEPLOYED app + its Supabase project, over HTTP only (no browser).
//
//   read-only checks (default): which tables / columns / functions / enum values exist, can a client read the catalogue
//   --write: also plays a full SHOPPING order and a full RIDE with a test client and a test Boda
//            (this writes rows to that database: names start with "SMOKE TEST")
//
//   APP_URL=https://boda-kilgoris.vercel.app \
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=sb_publishable_... \
//   [SMOKE_BODA_PHONE=07... SMOKE_BODA_PIN=1234]   # an APPROVED Boda, needed for --write
//   node scripts/prod-smoke.mjs [--write]
const APP = (process.env.APP_URL ?? '').replace(/\/$/, '');
const SB = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const WRITE = process.argv.includes('--write');
if (!APP || !SB || !KEY) { console.error('Set APP_URL, SUPABASE_URL and SUPABASE_ANON_KEY.'); process.exit(2); }

let failed = 0;
const line = (ok, name, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json' });
const get = async (path, token) => { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: headers(token) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const rpc = async (fn, args, token) => { const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(token), body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const post = async (path, body) => { const r = await fetch(`${APP}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const sub = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;
const err = (r) => r.body?.message ?? r.body?.code ?? `HTTP ${r.status}`;

// ---- 1. anonymous (what a visitor's browser sees)
const anonCat = await get('catalog_items?select=id,active&limit=200');
line(Array.isArray(anonCat.body) && anonCat.body.length > 0, 'anonymous visitor reads the catalogue', Array.isArray(anonCat.body) ? `${anonCat.body.length} articles` : err(anonCat));
const anonWrite = await fetch(`${SB}/rest/v1/catalog_items`, { method: 'POST', headers: headers(), body: JSON.stringify({ name_en: 'x', name_sw: 'y', category: 'z' }) });
line(anonWrite.status >= 400, 'anonymous visitor cannot write the catalogue', `HTTP ${anonWrite.status}`);

// ---- 2. a test client
const phone = process.env.SMOKE_CLIENT_PHONE ?? '0700000098';
const started = await post('/api/auth/client/start', { name: 'SMOKE TEST client', phone, language: 'en' });
if (!started.body?.ok) { line(false, 'test client sign-in', err(started)); process.exit(1); }
const cTok = started.body.session.access_token;
line(true, 'test client signed in');
const cat = await get('catalog_items?select=*&order=category,sort_order', cTok);
line(Array.isArray(cat.body) && cat.body.length >= 20, 'signed-in client reads the catalogue (>= 20 articles)', Array.isArray(cat.body) ? `${cat.body.length}, categories: ${[...new Set(cat.body.map((c) => c.category))].join(' | ')}` : err(cat));
line(Array.isArray(cat.body) && cat.body.every((c) => c.active), 'only active articles are returned');

// ---- 3. schema
const cols = ['type', 'budget_max_kes', 'client_note', 'delivery_landmark', 'items_count', 'items_total_kes', 'delivery_fee_kes', 'receipts_kept', 'receipts_shown', 'problem_reported', 'problem_type', 'problem_text', 'destination_lat', 'destination_lng', 'pickup_note'];
const missingCols = [];
for (const c of cols) if ((await get(`rides?select=${c}&limit=1`, cTok)).status !== 200) missingCols.push(c);
line(missingCols.length === 0, 'rides has every added column', missingCols.join(', '));
for (const t of ['ride_items', 'places']) { const r = await get(`${t}?select=*&limit=1`, cTok); line(r.status === 200, `table ${t} exists and the client can read it`, r.status === 200 ? '' : err(r)); }
const missingStatus = [];
for (const s of ['shopping', 'purchased', 'delivering']) if ((await get(`rides?select=id&status=eq.${s}&limit=1`, cTok)).status !== 200) missingStatus.push(s);
line(missingStatus.length === 0, 'ride_status has shopping / purchased / delivering', missingStatus.join(', '));
const zero = '00000000-0000-0000-0000-000000000000';
const fn1 = await rpc('request_shopping', { p_boda_id: zero, p_lat: -1, p_lng: 34.8, p_items: [] }, cTok);
line(fn1.body?.message === 'empty_list', 'request_shopping exists (an empty list is refused)', err(fn1));
const fn2 = await rpc('request_ride', { p_boda_id: zero, p_lat: null, p_lng: null, p_destination: null, p_dest_lat: null, p_dest_lng: null, p_pickup_note: null }, cTok);
line(fn2.body?.message === 'invalid_location', 'request_ride has the current signature (destination optional)', err(fn2));
const fn3 = await rpc('shopping_start', { p_ride_id: zero }, cTok);
line(fn3.body?.message === 'ride_not_found', 'shopping step functions exist', err(fn3));
const fn4 = await rpc('report_ride_problem', { p_ride_id: zero, p_type: 'other' }, cTok);
line(fn4.body?.message === 'ride_not_found', 'report_ride_problem exists', err(fn4));
const forged = await fetch(`${SB}/rest/v1/ride_items`, { method: 'POST', headers: headers(cTok), body: JSON.stringify({ ride_id: zero, custom_name: 'x', is_custom: true }) });
line(forged.status >= 400, 'a client cannot insert into ride_items directly (request_shopping writes the lines)', `HTTP ${forged.status}`);

// ---- 4. full orders (writes)
if (WRITE) {
  console.log('\n--- --write: full shopping order, then a full ride (rows named "SMOKE TEST") ---');
  const bPhone = process.env.SMOKE_BODA_PHONE, bPin = process.env.SMOKE_BODA_PIN;
  if (!bPhone || !bPin) { console.error('--write needs SMOKE_BODA_PHONE and SMOKE_BODA_PIN of an APPROVED Boda.'); process.exit(2); }
  const login = await post('/api/auth/boda/login', { phone: bPhone, pin: bPin });
  if (!login.body?.ok) { line(false, 'Boda sign-in', err(login)); process.exit(1); }
  const bTok = login.body.session.access_token, bodaId = sub(bTok);
  line(true, 'Boda signed in');
  const online = async () => rpc('set_availability', { p_available: true, p_lat: -1.0035, p_lng: 34.8767, p_accuracy: 10 }, bTok);
  const step = async (name, who, fn, args) => { const r = await rpc(fn, args, who); line(r.status < 300, name, r.status < 300 ? '' : err(r)); return r; };

  // leftovers of an earlier failed run would block the new order
  for (const tok of [cTok]) { const open = await get('rides?select=id,status&status=in.(requested,accepted,arrived,shopping,purchased,delivering)', tok); for (const o of open.body ?? []) await rpc('cancel_ride', { p_ride_id: o.id }, tok); }

  await step('Boda goes online', bTok, 'set_availability', { p_available: true, p_lat: -1.0035, p_lng: 34.8767, p_accuracy: 10 });
  const list = await rpc('available_bodas', {}, cTok);
  line(Array.isArray(list.body) && list.body.some((b) => b.id === bodaId), 'the client sees the Boda in the list');
  const items = [{ catalog_item_id: cat.body[0].id, quantity: 2 }, { catalog_item_id: cat.body[1].id, quantity: 1 }, { custom_name: 'SMOKE TEST free-text article', quantity: 1 }];
  const o = await step('client sends the shopping list (2 catalogue + 1 free-text)', cTok, 'request_shopping', { p_boda_id: bodaId, p_lat: -1.0035, p_lng: 34.8767, p_items: items, p_budget: 1000, p_note: 'SMOKE TEST', p_landmark: 'SMOKE TEST gate' });
  const id = o.body?.id;
  if (!id) process.exit(1);
  line(o.body.type === 'shopping' && o.body.items_count === 3 && o.body.client_phone === null, 'order created as shopping, 3 items, client phone not shared yet');
  await step('Boda accepts', bTok, 'accept_ride', { p_ride_id: id });
  const seen = await get(`rides?select=client_phone&id=eq.${id}`, bTok);
  line(seen.body?.[0]?.client_phone, 'the assigned Boda now sees the client phone');
  await step('Boda: "I am shopping"', bTok, 'shopping_start', { p_ride_id: id });
  const lines = (await get(`ride_items?select=id,name_en,custom_name&ride_id=eq.${id}&order=position`, bTok)).body ?? [];
  line(lines.length === 3, 'the Boda reads the 3 lines');
  await step('item 1 bought', bTok, 'shopping_set_item', { p_item_id: lines[0].id, p_status: 'bought' });
  await step('item 2 not found', bTok, 'shopping_set_item', { p_item_id: lines[1].id, p_status: 'not_found' });
  await step('item 3 replaced', bTok, 'shopping_set_item', { p_item_id: lines[2].id, p_status: 'replaced', p_replacement: 'SMOKE substitute', p_no_receipt: true });
  const noReceipts = await rpc('shopping_purchased', { p_ride_id: id, p_items_total_kes: 300, p_receipts_kept: false }, bTok);
  line(noReceipts.body?.message === 'receipts_required', '"Shopping done" refused without the receipts box');
  await step('"Shopping done": total 300 + receipts kept', bTok, 'shopping_purchased', { p_ride_id: id, p_items_total_kes: 300, p_receipts_kept: true });
  const total = await get(`rides?select=items_total_kes,status&id=eq.${id}`, cTok);
  line(total.body?.[0]?.items_total_kes === 300, 'the client sees the items total before delivery', `status ${total.body?.[0]?.status}`);
  await step('Boda: on the way', bTok, 'shopping_deliver_start', { p_ride_id: id });
  const noShown = await rpc('shopping_complete', { p_ride_id: id, p_delivery_fee_kes: 50, p_receipts_shown: false }, bTok);
  line(noShown.body?.message === 'receipts_required', '"Delivered" refused without the receipts-shown box');
  await step('Boda: delivered (fee 50 + receipts shown)', bTok, 'shopping_complete', { p_ride_id: id, p_delivery_fee_kes: 50, p_receipts_shown: true });
  const conf = await step('client confirms the delivery (rating 5)', cTok, 'confirm_ride', { p_ride_id: id, p_rating: 5 });
  line(conf.body?.counted === true && conf.body?.client_phone === null, 'order counted; client phone removed from the finished order');

  await step('Boda online again', bTok, 'set_availability', { p_available: true, p_lat: -1.0035, p_lng: 34.8767, p_accuracy: 10 });
  const ride = await step('RIDE: client requests (no destination)', cTok, 'request_ride', { p_boda_id: bodaId, p_lat: -1.0035, p_lng: 34.8767, p_destination: null, p_dest_lat: null, p_dest_lng: null, p_pickup_note: 'SMOKE TEST' });
  const rid = ride.body?.id;
  if (rid) {
    await step('RIDE: accept', bTok, 'accept_ride', { p_ride_id: rid });
    await step('RIDE: arrived', bTok, 'arrive_ride', { p_ride_id: rid });
    await step('RIDE: completed', bTok, 'complete_ride', { p_ride_id: rid, p_price_kes: null });
    const rc = await step('RIDE: client confirms (rating 4)', cTok, 'confirm_ride', { p_ride_id: rid, p_rating: 4 });
    line(rc.body?.counted === true && rc.body?.type === 'ride', 'ride counted, type = ride');
  }
  void online;
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
