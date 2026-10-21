import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the real migration on an in-process Postgres (PGlite) and exercises
// RLS + the ride state machine. Usage: npm run test:db
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = fs.readdirSync(path.join(here, '..', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const SEED_MIGRATION = '20261022000000_catalog_seed_and_public_read.sql';

const db = new PGlite();
let failures = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; } else { failures++; console.log('  ✗ FAIL:', msg); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- what Supabase does by default for objects created in the public schema
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const m of MIGRATIONS) await db.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8'));
console.log('migrations applied:', MIGRATIONS.join(', '));

const ID = { admin: '00000000-0000-0000-0000-0000000000a1', b1: '00000000-0000-0000-0000-0000000000b1',
  b2: '00000000-0000-0000-0000-0000000000b2', c1: '00000000-0000-0000-0000-0000000000c1',
  c2: '00000000-0000-0000-0000-0000000000c2' };
for (const id of Object.values(ID)) await db.exec(`insert into auth.users values ('${id}')`);
await db.exec(`
  insert into profiles (id, role, name, phone, language) values
   ('${ID.admin}','admin','Admin',null,'en'),
   ('${ID.b1}','boda','Otieno Boda','+254700000001','sw'),
   ('${ID.b2}','boda','Wanjiru Boda','+254700000002','en'),
   ('${ID.c1}','client','Alice Client','+254711000001','en'),
   ('${ID.c2}','client','Baraka Mteja','+254711000002','sw');
  insert into boda_profiles (user_id, plate) values ('${ID.b1}','KMFA 123A'),('${ID.b2}','KMFB 456B');
`);

async function as(who, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ID[who]}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}
async function fails(who, sql, expected) {
  try { await as(who, () => db.query(sql)); return ok(false, `expected failure: ${sql}`); }
  catch (e) { ok(expected ? e.message.includes(expected) : true, `${sql} -> wrong error: ${e.message} (wanted ${expected})`); }
}
const q = (who, sql) => as(who, async () => (await db.query(sql)).rows);

console.log('\n# permissions');
await fails('c1', `select run_sweep()`, 'permission denied');
await fails('c1', `select touch_boda_activity('${ID.b1}')`, 'permission denied');
await fails('c1', `delete from rides`, 'permission denied');
await fails('c1', `insert into rides (client_id) values ('${ID.c1}')`, 'permission denied');
await fails('c1', `update profiles set role='admin' where id='${ID.c1}'`, 'permission denied');
await fails('b1', `update boda_profiles set status='approved' where user_id='${ID.b1}'`, 'permission denied');
await fails('c1', `select admin_overview()`, 'forbidden');
await db.exec(`set role anon`);
try { await db.query('select * from profiles'); ok(false, 'anon select profiles'); } catch (e) { ok(/permission denied/.test(e.message), 'anon denied: ' + e.message); }
try { await db.query('select sweep_rides()'); ok(false, 'anon sweep'); } catch (e) { ok(/permission denied/.test(e.message), 'anon fn denied: ' + e.message); }
await db.exec(`reset role`);
ok((await q('c1', `select * from profiles`)).length === 1, 'client sees only own profile');
ok((await q('c1', `select * from boda_profiles`)).length === 0, 'client cannot read boda_profiles');

console.log('\n# availability');
await fails('b1', `select set_availability(true, -1.0, 34.88)`, 'boda_not_approved');
await as('admin', () => db.query(`select admin_set_boda_status('${ID.b1}','approved')`));
await as('admin', () => db.query(`select admin_set_boda_status('${ID.b2}','approved')`));
await fails('b1', `select set_availability(true)`, 'invalid_location');
await as('b1', () => db.query(`select set_availability(true, -1.0033, 34.8767, 12)`));
ok((await q('c1', `select * from available_bodas()`)).length === 1, 'one boda available');
ok((await q('c1', `select * from boda_locations`)).length === 1, 'client sees available boda location');
// b2 has a location row but is NOT available -> invisible
await db.exec(`insert into boda_locations (boda_id, lat, lng) values ('${ID.b2}', -1.0, 34.9)`);
ok((await q('c1', `select * from boda_locations`)).length === 1, 'unavailable boda location hidden');
ok((await q('b2', `select * from boda_locations where boda_id='${ID.b2}'`)).length === 1, 'boda sees own location');
await fails('b2', `select update_location(-1.0, 34.9)`, 'not_available');
await db.exec(`delete from boda_locations where boda_id='${ID.b2}'`);
// stale location hidden
await db.exec(`update boda_locations set updated_at = now() - interval '10 minutes' where boda_id='${ID.b1}'`);
ok((await q('c1', `select * from available_bodas()`)).length === 0, 'stale location not listed');
await fails('c1', `select request_ride('${ID.b1}', -1.0, 34.88, 'x')`, 'boda_unavailable');
await as('b1', () => db.query(`select update_location(-1.0035, 34.877)`));
ok((await q('c1', `select * from available_bodas()`)).length === 1, 'fresh again');

console.log('\n# ride happy path');
const r = (await q('c1', `select * from request_ride('${ID.b1}', -1.003, 34.876, '  Hospital ')`))[0];
ok(r.status === 'requested' && r.destination_text === 'Hospital' && r.client_name === 'Alice Client' && r.boda_name === 'Otieno Boda', 'request created w/ snapshots');
ok(r.client_phone === null, 'phone not shared before acceptance');
await fails('c1', `select request_ride('${ID.b1}', -1.003, 34.876)`, 'client_has_active_ride');
ok((await q('c2', `select * from rides`)).length === 0, 'other client cannot see the ride');
ok((await q('b2', `select * from rides`)).length === 0, 'other boda cannot see the ride');
ok((await q('b1', `select * from rides`)).length === 1, 'requested boda sees the ride');
await fails('b2', `select accept_ride('${r.id}')`, 'ride_not_found');
await fails('c1', `select accept_ride('${r.id}')`, 'ride_not_found');
await fails('b1', `select arrive_ride('${r.id}')`, 'invalid_state');
const acc = (await q('b1', `select * from accept_ride('${r.id}')`))[0];
ok(acc.status === 'accepted' && acc.accepted_at && acc.client_phone === '+254711000001' && acc.boda_phone === '+254700000001', 'accepted + phones shared');
ok((await db.query(`select is_available from boda_profiles where user_id='${ID.b1}'`)).rows[0].is_available === false, 'boda auto-unavailable');
ok((await q('c1', `select * from boda_locations`)).length === 1, 'client follows accepted boda');
ok((await q('c2', `select * from boda_locations`)).length === 0, 'other client cannot see location');
await as('b1', () => db.query(`select update_location(-1.0034, 34.8768)`)); // allowed during ride
await fails('b1', `select set_availability(true, -1, 34.8)`, 'ride_in_progress');
await fails('c1', `select complete_ride('${r.id}')`, 'ride_not_found');
await fails('b1', `select complete_ride('${r.id}')`, 'invalid_state');
await as('b1', () => db.query(`select arrive_ride('${r.id}')`));
await fails('b1', `select complete_ride('${r.id}', 999999)`, 'invalid_price');
const done = (await q('b1', `select * from complete_ride('${r.id}', 300)`))[0];
ok(done.status === 'completed' && done.boda_confirmed && !done.client_confirmed && !done.counted, 'completed, not yet counted');
ok(done.suspect && done.suspect_reason.includes('too_fast'), 'too fast = suspect');
ok(done.agreed_price_kes === 300, 'price stored');
ok((await q('c1', `select * from boda_locations`)).length === 0, 'location removed after ride');
await fails('b1', `select confirm_ride('${r.id}', 5::smallint)`, 'ride_not_found');
await fails('c1', `select confirm_ride('${r.id}', 9::smallint)`, 'invalid_rating');
const conf = (await q('c1', `select * from confirm_ride('${r.id}', 5::smallint)`))[0];
ok(conf.counted && conf.counted_at && conf.client_confirmed && conf.rating === 5, 'counted after both confirmations');
const bp = (await db.query(`select rating_avg, rating_count from boda_profiles where user_id='${ID.b1}'`)).rows[0];
ok(Number(bp.rating_avg) === 5 && bp.rating_count === 1, 'rating aggregated');
await fails('c1', `select cancel_ride('${r.id}')`, 'invalid_state');

console.log('\n# decline / expire / cancel / concurrency');
await as('b1', () => db.query(`select set_availability(true, -1.0, 34.88)`));
const r2 = (await q('c1', `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
const r2b = (await q('c2', `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
ok((await q('b1', `select * from rides where status='requested'`)).length === 2, 'two pending requests visible to boda');
await as('b1', () => db.query(`select accept_ride('${r2.id}')`));
ok((await db.query(`select status from rides where id='${r2b.id}'`)).rows[0].status === 'declined', 'other pending request auto-declined');
await fails('c2', `select cancel_ride('${r2b.id}')`, 'invalid_state');
const cx = (await q('c1', `select * from cancel_ride('${r2.id}')`))[0];
ok(cx.status === 'cancelled' && cx.cancelled_by === 'client', 'client cancel');
await as('b1', () => db.query(`select set_availability(true, -1.0, 34.88)`));
const r3 = (await q('c2', `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
await db.exec(`update rides set expires_at = now() - interval '1 second' where id='${r3.id}'`);
await fails('b1', `select accept_ride('${r3.id}')`, 'ride_expired');
await as('c1', () => db.query(`select sweep_rides()`));
ok((await db.query(`select status from rides where id='${r3.id}'`)).rows[0].status === 'expired', 'sweep expires request');
const d = (await q('c2', `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
const dec = (await q('b1', `select * from decline_ride('${d.id}')`))[0];
ok(dec.status === 'declined', 'decline');
await fails('b1', `select decline_ride('${d.id}')`, 'invalid_state');

console.log('\n# state machine guard (raw SQL as superuser)');
const g = (await q('c1', `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
try { await db.query(`update rides set status='completed' where id='${g.id}'`); ok(false, 'requested->completed should fail'); }
catch (e) { ok(e.message.includes('invalid_transition'), e.message); }
try { await db.query(`update rides set client_confirmed=true where id='${g.id}'`); ok(false, 'confirm on non-completed'); }
catch (e) { ok(e.message.includes('invalid_state'), e.message); }
try { await db.query(`update rides set pickup_lat=0 where id='${g.id}'`); ok(false, 'immutable'); }
catch (e) { ok(e.message.includes('immutable_field'), e.message); }
await q('c1', `select cancel_ride('${g.id}')`);
try { await db.query(`update rides set status='requested' where id='${g.id}'`); ok(false, 'terminal'); }
catch (e) { ok(e.message.includes('invalid_transition'), e.message); }

console.log('\n# auto-confirm + pair frequency');
async function fullRide(client, price = 100) {
  await as('b1', () => db.query(`select set_availability(true, -1.0, 34.88)`));
  const x = (await q(client, `select * from request_ride('${ID.b1}', -1.0, 34.88)`))[0];
  await as('b1', () => db.query(`select accept_ride('${x.id}')`));
  await as('b1', () => db.query(`select arrive_ride('${x.id}')`));
  await as('b1', () => db.query(`select complete_ride('${x.id}', ${price})`));
  return x.id;
}
const ids = [];
for (let i = 0; i < 11; i++) ids.push(await fullRide('c2'));
const flagged = (await db.query(`select count(*)::int n from rides where id = any($1::uuid[]) and 'pair_frequency' = any(suspect_reason)`, [ids])).rows[0].n;
ok(flagged === 11, `all 11 rides of the pair flagged (got ${flagged})`);
// make one old enough for auto-confirm
await db.exec(`update rides set completed_at = now() - interval '31 minutes' where id='${ids[0]}'`);
await as('c1', () => db.query(`select sweep_rides()`));
const auto = (await db.query(`select * from rides where id='${ids[0]}'`)).rows[0];
ok(auto.client_confirmed && auto.auto_confirmed && auto.counted, 'auto-confirmed after 30 min and counted');
const fresh = (await db.query(`select * from rides where id='${ids[1]}'`)).rows[0];
ok(!fresh.client_confirmed && !fresh.counted, 'recent ride not auto-confirmed');

console.log('\n# stale availability');
await as('b1', () => db.query(`select set_availability(true, -1.0, 34.88)`));
await db.exec(`update boda_locations set updated_at = now() - interval '20 minutes' where boda_id='${ID.b1}'`);
await as('c1', () => db.query(`select sweep_rides()`));
ok((await db.query(`select is_available from boda_profiles where user_id='${ID.b1}'`)).rows[0].is_available === false, 'silent boda switched off');
ok((await db.query(`select count(*)::int n from boda_locations`)).rows[0].n === 0, 'orphan location rows removed');

console.log('\n# optional destination: every combination runs the whole lifecycle');
// b2 is a separate Boda from the ones above, so the pair-frequency flags of the earlier rides do not interfere
async function cycle(label, who, requestSql, expect) {
  await as('b2', () => db.query(`select set_availability(true, -1.0, 34.88)`));
  const x = (await q(who, requestSql))[0];
  for (const [k, v] of Object.entries(expect)) ok(x[k] === v, `${label}: ${k} = ${JSON.stringify(v)} (got ${JSON.stringify(x[k])})`);
  const seenByBoda = (await q('b2', `select * from rides where id='${x.id}'`))[0];
  ok(seenByBoda && seenByBoda.destination_lat === x.destination_lat && seenByBoda.pickup_note === x.pickup_note, `${label}: Boda reads the same row`);
  const a = (await q('b2', `select * from accept_ride('${x.id}')`))[0];
  const ar = (await q('b2', `select * from arrive_ride('${x.id}')`))[0];
  const dn = (await q('b2', `select * from complete_ride('${x.id}', 200)`))[0];
  const cf = (await q(who, `select * from confirm_ride('${x.id}', 4::smallint)`))[0];
  ok(a.status === 'accepted' && ar.status === 'arrived' && dn.status === 'completed', `${label}: accepted -> arrived -> completed`);
  ok(cf.client_confirmed && cf.counted && cf.rating === 4, `${label}: confirmed, counted, rated 4`);
  ok(cf.destination_text === x.destination_text && cf.destination_lat === x.destination_lat && cf.destination_lng === x.destination_lng,
     `${label}: destination untouched by the lifecycle`);
  return x;
}
ok((await q('c1', `select * from places`)).length === 0, 'places starts EMPTY (nothing invented)');
await fails('c1', `select admin_save_place(null, 'Market', -1.0, 34.8, true)`, 'forbidden');
await fails('c1', `insert into places (name, lat, lng) values ('x', 0, 0)`, 'permission denied');
await fails('c1', `update places set active = false`, 'permission denied');
await fails('admin', `select admin_save_place(null, '   ', -1.0, 34.8, true)`, 'invalid_place');
await fails('admin', `select admin_save_place(null, 'Far', 95, 34.8, true)`, 'invalid_place');
await fails('admin', `select admin_save_place('00000000-0000-0000-0000-00000000dead', 'Ghost', -1, 34, true)`, 'not_found');
const place = (await q('admin', `select * from admin_save_place(null, '  Kilgoris Market ', -1.0041, 34.8795, true)`))[0];
ok(place.name === 'Kilgoris Market' && place.active, 'admin adds a place (name trimmed)');
await q('admin', `select * from admin_save_place(null, 'Old stage', -1.001, 34.87, false)`);
ok((await q('c1', `select * from places`)).length === 1, 'client sees only ACTIVE places');
ok((await q('admin', `select * from places`)).length === 2, 'admin sees all places');
const edited = (await q('admin', `select * from admin_save_place('${place.id}', 'Kilgoris Main Market', -1.0042, 34.8796, true)`))[0];
ok(edited.name === 'Kilgoris Main Market' && edited.lat === -1.0042, 'admin edits a place');

const A = await cycle('A no destination', 'c1', `select * from request_ride('${ID.b2}', -1.003, 34.876)`,
  { destination_text: null, destination_lat: null, destination_lng: null, pickup_note: null });
await cycle('B text only', 'c2', `select * from request_ride('${ID.b2}', -1.003, 34.876, 'behind the school')`,
  { destination_text: 'behind the school', destination_lat: null, destination_lng: null });
await cycle('C text + pin + landmark', 'c1',
  `select * from request_ride('${ID.b2}', -1.003, 34.876, 'near the church', -1.0101, 34.8802, '  blue shop  ')`,
  { destination_text: 'near the church', destination_lat: -1.0101, destination_lng: 34.8802, pickup_note: 'blue shop' });
await cycle('D quick place', 'c2',
  `select * from request_ride('${ID.b2}', -1.003, 34.876, '${edited.name}', ${edited.lat}, ${edited.lng})`,
  { destination_text: 'Kilgoris Main Market', destination_lat: -1.0042, destination_lng: 34.8796 });
await cycle('E pin only (no text)', 'c1', `select * from request_ride('${ID.b2}', -1.003, 34.876, null, -1.02, 34.89)`,
  { destination_text: null, destination_lat: -1.02, destination_lng: 34.89 });
ok(A.destination_text === null, 'A stored NULL, not an empty string');

console.log('\n# destination never blocks a request, pick-up still does');
async function lenient(sql, expect) {
  await as('b2', () => db.query(`select set_availability(true, -1.0, 34.88)`));
  const x = (await q('c1', sql))[0];
  for (const [k, v] of Object.entries(expect)) ok(x[k] === v, `${sql.slice(0, 70)}… ${k}=${JSON.stringify(v)} (got ${JSON.stringify(x[k])})`);
  await q('c1', `select cancel_ride('${x.id}')`);
}
await lenient(`select * from request_ride('${ID.b2}', -1.0, 34.88, '   ')`, { destination_text: null });
await lenient(`select * from request_ride('${ID.b2}', -1.0, 34.88, 'x', -1.0, null)`, { destination_text: 'x', destination_lat: null, destination_lng: null });
await lenient(`select * from request_ride('${ID.b2}', -1.0, 34.88, 'x', 123, 34.8)`, { destination_lat: null, destination_lng: null });
await lenient(`select * from request_ride('${ID.b2}', -1.0, 34.88, 'x', -1.0, 999)`, { destination_lat: null, destination_lng: null });
await lenient(`select * from request_ride('${ID.b2}', -1.0, 34.88, '${'z'.repeat(300)}', null, null, '${'n'.repeat(300)}')`, {});
const long = (await db.query(`select destination_text, pickup_note from rides order by created_at desc limit 1`)).rows[0];
ok(long.destination_text.length === 200 && long.pickup_note.length === 200, 'over-long text is cut, not rejected');
await as('b2', () => db.query(`select set_availability(true, -1.0, 34.88)`));
await fails('c1', `select request_ride('${ID.b2}', null, 34.88, 'market', -1.0, 34.8)`, 'invalid_location');
await fails('c1', `select request_ride('${ID.b2}', -1.0, 999, 'market', -1.0, 34.8)`, 'invalid_location');

console.log('\n# migration safety: existing rides survive, re-running is harmless');
await db.exec(fs.readFileSync(path.join(here, '..', 'migrations', SEED_MIGRATION), 'utf8'));
ok((await q('c1', `select * from places`)).length === 1, 're-running the migration keeps the places');
{
  const old = new PGlite();
  await old.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;`);
  await old.exec(fs.readFileSync(path.join(here, '..', 'migrations', MIGRATIONS[0]), 'utf8'));
  await old.exec(`
    insert into auth.users values ('${ID.b1}'), ('${ID.c1}');
    insert into profiles (id, role, name, phone, language) values ('${ID.b1}','boda','Old Boda','+254700000001','sw'), ('${ID.c1}','client','Old Client','+254711000001','en');
    insert into boda_profiles (user_id, plate) values ('${ID.b1}','KMFA 123A');
    insert into rides (client_id, boda_id, status, pickup_lat, pickup_lng, destination_text, expires_at, client_name, boda_name, boda_plate)
      values ('${ID.c1}','${ID.b1}','completed',-1.0,34.88,'Hospital', now(), 'Old Client','Old Boda','KMFA 123A');`);
  for (const m of MIGRATIONS.slice(1)) await old.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8'));
  const row = (await old.query(`select * from rides`)).rows[0];
  ok(row.destination_text === 'Hospital' && row.destination_lat === null && row.destination_lng === null && row.pickup_note === null,
     'a ride made before the migration is intact (new columns NULL)');
  ok((await old.query(`select count(*)::int n from places`)).rows[0].n === 0, 'places empty after migrating a live database');
  await old.close();
}

console.log('\n# shopping orders: catalogue, request, items, receipts gates, amounts');
const cat = await q('c1', `select * from catalog_items order by sort_order`);
ok(cat.length === 26 && cat[0].name_en === 'Sugar' && cat[0].name_sw === 'Sukari' && cat[0].unit === 'kg', 'seed catalogue (26 articles) readable by clients');
ok(new Set(cat.map((c) => c.category)).size === 5, 'five categories');
await fails('c1', `insert into catalog_items (name_en, name_sw, category) values ('x','y','z')`, 'permission denied');
await fails('c1', `update catalog_items set active = false`, 'permission denied');
await fails('c1', `select admin_save_catalog_item(null, 'Fish', 'Samaki', 'fresh', 'kg')`, 'forbidden');
await fails('admin', `select admin_save_catalog_item(null, '', 'Samaki', 'fresh', 'kg')`, 'invalid_item');
await fails('admin', `select admin_save_catalog_item('00000000-0000-0000-0000-00000000dead', 'a', 'b', 'c', 'd')`, 'not_found');
const fish = (await q('admin', `select * from admin_save_catalog_item(null, ' Fish ', 'Samaki', 'fresh', 'kg')`))[0];
ok(fish.name_en === 'Fish' && fish.sort_order > cat.at(-1).sort_order && fish.active, 'admin adds an article (appended at the end)');
const fish2 = (await q('admin', `select * from admin_save_catalog_item('${fish.id}', 'Tilapia', 'Sato', 'fresh', 'piece', false)`))[0];
ok(fish2.name_en === 'Tilapia' && fish2.unit === 'piece' && !fish2.active, 'admin edits + deactivates an article');
ok((await q('c1', `select * from catalog_items`)).length === 26, 'clients do not see a deactivated article');
ok((await q('admin', `select * from catalog_items`)).length === 27, 'admin sees all articles');
const [first, second] = cat;
await as('admin', () => db.query(`select admin_swap_catalog_order('${first.id}', '${second.id}')`));
ok((await q('c1', `select name_en from catalog_items order by sort_order limit 1`))[0].name_en === second.name_en, 'admin reorders articles');
// catalogue visibility for anonymous visitors + idempotent seed (20261022 migration)
await db.exec(`set role anon`);
const anonCat = (await db.query(`select * from catalog_items`)).rows;
ok(anonCat.length === 26 && anonCat.every((c) => c.active), 'anonymous visitors read the ACTIVE articles only (the deactivated one is hidden)');
try { await db.query(`insert into catalog_items (name_en, name_sw, category) values ('x','y','z')`); ok(false, 'anon insert'); } catch (e) { ok(/permission denied/.test(e.message), 'anon cannot write the catalogue'); }
try { await db.query(`update catalog_items set active = false`); ok(false, 'anon update'); } catch (e) { ok(/permission denied/.test(e.message), 'anon cannot update the catalogue'); }
try { await db.query(`select * from ride_items`); ok(false, 'anon ride_items'); } catch (e) { ok(/permission denied/.test(e.message), 'anonymous visitors cannot read order lines'); }
await db.exec(`reset role`);
const sugarBefore = cat.find((c) => c.name_en === 'Sugar');
await as('admin', () => db.query(`select admin_save_catalog_item('${sugarBefore.id}', 'Sugar (white)', 'Sukari nyeupe', 'staples', 'kg', true)`));
const candles = cat.find((c) => c.name_en === 'Candles');
await as('admin', () => db.query(`select admin_save_catalog_item('${candles.id}', 'Candles', 'Mishumaa', 'home', 'packet', false)`));
const seedSql = fs.readFileSync(path.join(here, '..', 'migrations', SEED_MIGRATION), 'utf8');
await db.exec(seedSql);
await db.exec(seedSql);
const total = (await db.query(`select count(*)::int n from catalog_items`)).rows[0].n;
ok(total === 27, `seed run twice: no duplicate (26 seed + 1 admin article = 27, got ${total})`);
ok((await db.query(`select count(*)::int n from catalog_items where name_en = 'Sugar'`)).rows[0].n === 0, 'an article the admin renamed is not re-created by the seed');
ok((await db.query(`select active from catalog_items where name_en = 'Candles'`)).rows[0].active === false, 'an article the admin hid stays hidden after the seed');
await as('admin', () => db.query(`select admin_save_catalog_item('${sugarBefore.id}', 'Sugar', 'Sukari', 'staples', 'kg', true)`));
await as('admin', () => db.query(`select admin_save_catalog_item('${candles.id}', 'Candles', 'Mishumaa', 'home', 'packet', true)`));
// a catalogue seeded earlier with RANDOM ids must not be duplicated either
{
  const old = new PGlite();
  await old.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant execute on functions to anon, authenticated;`);
  for (const m of MIGRATIONS.filter((x) => x !== SEED_MIGRATION)) await old.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8'));
  await old.exec(`delete from catalog_items; insert into catalog_items (name_en, name_sw, category, unit, sort_order) values ('Sugar', 'Sukari', 'staples', 'kg', 10), ('Rice', 'Mchele', 'staples', 'kg', 30)`);
  await old.exec(seedSql);
  const n = (await old.query(`select count(*)::int n from catalog_items`)).rows[0].n;
  ok(n === 26, `catalogue seeded earlier with random ids: seed completes it without duplicates (${n})`);
  await old.close();
}
const sugar = cat.find((c) => c.name_en === 'Sugar'), flour = cat.find((c) => c.name_en === 'Maize flour'), tea = cat.find((c) => c.name_en === 'Tea leaves');
const items = (...x) => JSON.stringify(x).replace(/'/g, "''");

async function online(b = 'b2') { await as(b, () => db.query(`select set_availability(true, -1.0, 34.88)`)); }
await online('b2');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '[]'::jsonb)`, 'empty_list');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, null)`, 'empty_list');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '{"a":1}'::jsonb)`, 'empty_list');
await fails('c1', `select request_shopping('${ID.b2}', null, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`, 'invalid_location');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: fish.id })}'::jsonb)`, 'invalid_item');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '${items({ custom_name: '   ' })}'::jsonb)`, 'invalid_item');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: '00000000-0000-0000-0000-00000000dead' })}'::jsonb)`, 'invalid_item');
await fails('admin', `select request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`, 'not_a_client');
await fails('c1', `select request_shopping('${ID.b1}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`, 'boda_unavailable'); // b1 is not available
ok((await db.query(`select count(*)::int n from rides where type = 'shopping'`)).rows[0].n === 0, 'failed requests leave nothing behind (no ride, no items)');
ok((await db.query(`select count(*)::int n from ride_items`)).rows[0].n === 0, 'no orphan items');

// (a) catalogue only -> the full path
const a = (await q('c1', `select * from request_shopping('${ID.b2}', -1.003, 34.876,
  '${items({ catalog_item_id: sugar.id, quantity: 2 }, { catalog_item_id: flour.id, quantity: 1 }, { catalog_item_id: tea.id })}'::jsonb,
  1500, 'Brand: Kakira please', 'green gate')`))[0];
ok(a.type === 'shopping' && a.status === 'requested' && a.items_count === 3 && a.budget_max_kes === 1500
   && a.client_note === 'Brand: Kakira please' && a.delivery_landmark === 'green gate' && a.pickup_note === null, 'shopping request created');
ok(a.client_phone === null && a.items_total_kes === null && a.delivery_fee_kes === null && !a.receipts_kept && !a.receipts_shown && !a.problem_reported, 'no phone / amounts / flags yet');
const aItems = await q('c1', `select * from ride_items where ride_id = '${a.id}' order by position`);
ok(aItems.length === 3 && aItems[0].name_en === 'Sugar' && aItems[0].name_sw === 'Sukari' && aItems[0].quantity === 2 && aItems[0].unit === 'kg' && !aItems[0].is_custom && aItems[0].status === 'pending',
   'lines copied with name snapshot, unit, quantity');
ok(aItems[2].quantity === 1, 'quantity defaults to 1');
await fails('c1', `select request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`, 'client_has_active_ride');
ok((await q('c2', `select * from ride_items`)).length === 0, 'another client cannot read the items');
ok((await q('b1', `select * from ride_items`)).length === 0 && (await q('b1', `select * from rides where id='${a.id}'`)).length === 0, 'another Boda cannot read the order or its items');
ok((await q('b2', `select * from ride_items where ride_id = '${a.id}'`)).length === 3, 'the requested Boda reads the full list before accepting');
ok((await q('admin', `select * from ride_items where ride_id = '${a.id}'`)).length === 3, 'admin reads the items');
await fails('b2', `update ride_items set status = 'bought'`, 'permission denied');
await fails('b2', `select shopping_start('${a.id}')`, 'invalid_state');                  // not accepted yet
await fails('b2', `select shopping_set_item('${aItems[0].id}', 'bought')`, 'invalid_state');
const aa = (await q('b2', `select * from accept_ride('${a.id}')`))[0];
ok(aa.status === 'accepted' && aa.client_phone === '+254711000001', 'accept: the client phone reaches the assigned Boda');
ok((await q('b1', `select * from rides where id='${a.id}' or client_phone = '+254711000001' and boda_id <> '${ID.b1}'`)).length === 0, 'the phone is visible to nobody else (other Boda)');
ok((await q('c2', `select * from rides where id='${a.id}'`)).length === 0, 'the phone is visible to nobody else (other client)');
ok((await db.query(`select is_available from boda_profiles where user_id='${ID.b2}'`)).rows[0].is_available === false, 'Boda automatically unavailable during the order');
await fails('b2', `select arrive_ride('${a.id}')`, 'invalid_transition');                  // shopping has no "arrived"
await fails('b2', `select complete_ride('${a.id}')`, 'invalid_state');
await fails('b2', `select shopping_purchased('${a.id}', 100, true)`, 'invalid_state');
await fails('c1', `select shopping_start('${a.id}')`, 'ride_not_found');
await fails('b1', `select shopping_start('${a.id}')`, 'ride_not_found');
await fails('b2', `select set_availability(true, -1, 34.8)`, 'ride_in_progress');
const as1 = (await q('b2', `select * from shopping_start('${a.id}')`))[0];
ok(as1.status === 'shopping' && as1.shopping_at, 'accepted -> shopping');
ok((await q('c1', `select * from boda_locations`)).length === 1, 'client follows the Boda during shopping');
await as('b2', () => db.query(`select update_location(-1.0034, 34.8768)`));

// (d) not found / replaced / bought / no receipt
await fails('b1', `select shopping_set_item('${aItems[0].id}', 'bought')`, 'item_not_found');
await fails('c1', `select shopping_set_item('${aItems[0].id}', 'bought')`, 'item_not_found');
await fails('b2', `select shopping_set_item('00000000-0000-0000-0000-00000000dead', 'bought')`, 'item_not_found');
await fails('b2', `select shopping_set_item('${aItems[0].id}', 'weird')`, 'invalid_item');
const i0 = (await q('b2', `select * from shopping_set_item('${aItems[0].id}', 'bought', null, true)`))[0];
ok(i0.status === 'bought' && i0.no_receipt === true, 'bought + "no receipt" (market stall)');
const i1 = (await q('b2', `select * from shopping_set_item('${aItems[1].id}', 'not_found')`))[0];
ok(i1.status === 'not_found' && i1.replacement_text === null, 'not found');
const i2 = (await q('b2', `select * from shopping_set_item('${aItems[2].id}', 'replaced', '  Ketepa tea  ')`))[0];
ok(i2.status === 'replaced' && i2.replacement_text === 'Ketepa tea', 'replaced with a replacement text');
const i2b = (await q('b2', `select * from shopping_set_item('${aItems[2].id}', 'replaced', '   ')`))[0];
ok(i2b.status === 'not_found' && i2b.replacement_text === null, 'replaced without text falls back to not found');
await q('b2', `select * from shopping_set_item('${aItems[2].id}', 'replaced', 'Ketepa tea')`);
const seen = await q('c1', `select status, replacement_text, no_receipt from ride_items where ride_id = '${a.id}' order by position`);
ok(seen.map((x) => x.status).join() === 'bought,not_found,replaced' && seen[2].replacement_text === 'Ketepa tea', 'the client sees bought / not found / replaced');

// receipts gate + amounts
await fails('b2', `select shopping_purchased('${a.id}', 850, false)`, 'receipts_required');
await fails('b2', `select shopping_purchased('${a.id}', 850, null)`, 'receipts_required');
await fails('b2', `select shopping_purchased('${a.id}', null, true)`, 'invalid_amount');
await fails('b2', `select shopping_purchased('${a.id}', -5, true)`, 'invalid_amount');
await fails('b2', `select shopping_deliver_start('${a.id}')`, 'invalid_state');
await fails('c1', `select shopping_purchased('${a.id}', 850, true)`, 'ride_not_found');
const ap = (await q('b2', `select * from shopping_purchased('${a.id}', 850, true)`))[0];
ok(ap.status === 'purchased' && ap.items_total_kes === 850 && ap.receipts_kept && ap.purchased_at, 'shopping -> purchased with total + receipts kept');
ok((await q('c1', `select items_total_kes from rides where id='${a.id}'`))[0].items_total_kes === 850, 'the client reads the items total right away');
await q('b2', `select * from shopping_set_item('${aItems[1].id}', null, null, true)`);       // still editable while purchased
await fails('b2', `select complete_ride('${a.id}')`, 'invalid_state');
const ad = (await q('b2', `select * from shopping_deliver_start('${a.id}')`))[0];
ok(ad.status === 'delivering' && ad.delivering_at, 'purchased -> delivering');
await fails('b2', `select shopping_set_item('${aItems[0].id}', 'pending')`, 'invalid_state');  // list frozen
await fails('b2', `select shopping_complete('${a.id}', 100, false)`, 'receipts_required');
await fails('b2', `select shopping_complete('${a.id}', null, true)`, 'invalid_amount');
await fails('b2', `select shopping_complete('${a.id}', 999999, true)`, 'invalid_amount');
ok((await q('c1', `select * from boda_locations`)).length === 1, 'client still follows the Boda while delivering');
const ac = (await q('b2', `select * from shopping_complete('${a.id}', 100, true)`))[0];
ok(ac.status === 'completed' && ac.delivery_fee_kes === 100 && ac.receipts_shown && ac.boda_confirmed && !ac.counted && !ac.client_confirmed, 'delivering -> completed (Boda side confirmed, not counted yet)');
ok(ac.client_phone === null, 'client phone removed from the order once it is over');
ok(ac.suspect && ac.suspect_reason.includes('too_fast'), 'closed in under 5 minutes = suspect');
ok((await q('c1', `select * from boda_locations`)).length === 0, 'Boda position no longer exposed after delivery');
await fails('b2', `select report_ride_problem('${a.id}', 'other')`, 'ride_not_found');       // only the client
const ap2 = (await q('c1', `select * from confirm_ride('${a.id}', 5::smallint)`))[0];
ok(ap2.counted && ap2.client_confirmed && ap2.rating === 5, 'client confirmation + rating -> counted (same rule as rides)');
ok((await q('b2', `select items_total_kes, delivery_fee_kes, receipts_kept, receipts_shown from rides where id='${a.id}'`))[0].delivery_fee_kes === 100, 'amounts stay readable');

console.log('\n# shopping: custom + mixed lists, decline, cancel, no-receipt never blocks');
await online('b2');
const b = (await q('c2', `select * from request_shopping('${ID.b2}', -1.003, 34.876,
  '${items({ custom_name: '2 packets of Krackers biscuits', quantity: 1 }, { custom_name: '  Blue Band  ' })}'::jsonb)`))[0];
const bItems = await q('c2', `select * from ride_items where ride_id = '${b.id}' order by position`);
ok(bItems.length === 2 && bItems.every((x) => x.is_custom && x.catalog_item_id === null && x.unit === null) && bItems[0].custom_name === '2 packets of Krackers biscuits' && bItems[1].custom_name === 'Blue Band', '(b) custom articles only (is_custom = true, trimmed)');
ok(b.budget_max_kes === null && b.client_note === null && b.delivery_landmark === null, 'budget / note / landmark are optional');
const decl = (await q('b2', `select * from decline_ride('${b.id}')`))[0];
ok(decl.status === 'declined' && decl.client_phone === null, 'Boda declines a shopping request');
ok((await q('c2', `select * from ride_items where ride_id = '${b.id}'`)).length === 2, 'the declined list is still readable (the app keeps it as a draft)');
await online('b1');
await as('admin', () => db.query(`select 1`));
const c = (await q('c2', `select * from request_shopping('${ID.b1}', -1.003, 34.876,
  '${items({ catalog_item_id: sugar.id, quantity: 3 }, { custom_name: 'Krackers' }, { catalog_item_id: tea.id, quantity: 99999 })}'::jsonb)`))[0];
const cItems = await q('c2', `select * from ride_items where ride_id = '${c.id}' order by position`);
ok(c.items_count === 3 && cItems[0].is_custom === false && cItems[1].is_custom === true && cItems[2].quantity === 10000, '(c) mixed list, another Boda after a refusal; absurd quantity is capped');
await q('b1', `select * from accept_ride('${c.id}')`);
ok((await q('b2', `select * from rides where id='${c.id}'`)).length === 0 && (await q('b2', `select * from ride_items where ride_id='${c.id}'`)).length === 0, 'the Boda who refused earlier cannot read the order of the next one');
await q('b1', `select * from shopping_start('${c.id}')`);
await q('b1', `select * from shopping_set_item('${cItems[0].id}', 'bought', null, true)`);
await q('b1', `select * from shopping_set_item('${cItems[1].id}', 'bought', null, true)`);
await q('b1', `select * from shopping_set_item('${cItems[2].id}', 'bought', null, true)`);
await q('b1', `select * from shopping_purchased('${c.id}', 0, true)`);                       // total 0 is a valid number
await q('b1', `select * from shopping_deliver_start('${c.id}')`);
await db.exec(`update rides set accepted_at = now() - interval '12 minutes' where id='${c.id}'`);
const cc = (await q('b1', `select * from shopping_complete('${c.id}', 0, true)`))[0];
ok(cc.status === 'completed' && !cc.suspect_reason.includes('too_fast') && cc.delivery_fee_kes === 0, '"no receipt" lines and 0 amounts never block the closing; 12 min is not suspect');
ok((await db.query(`select count(*)::int n from ride_items where ride_id='${c.id}' and no_receipt`)).rows[0].n === 3, '"no receipt" recorded on every line');
await db.exec(`update rides set completed_at = now() - interval '31 minutes' where id='${c.id}'`);
await as('c1', () => db.query(`select sweep_rides()`));
const auto2 = (await db.query(`select * from rides where id='${c.id}'`)).rows[0];
ok(auto2.client_confirmed && auto2.auto_confirmed && auto2.counted, 'shopping auto-confirmed after 30 min (flagged) and counted');

await online('b2');
const d1 = (await q('c1', `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`))[0];
const cx1 = (await q('c1', `select * from cancel_ride('${d1.id}')`))[0];
ok(cx1.status === 'cancelled' && cx1.cancelled_by === 'client', 'client cancels a requested shopping order');
const d2 = (await q('c1', `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`))[0];
await q('b2', `select * from accept_ride('${d2.id}')`);
await q('b2', `select * from shopping_start('${d2.id}')`);
const cx2 = (await q('b2', `select * from cancel_ride('${d2.id}')`))[0];
ok(cx2.status === 'cancelled' && cx2.cancelled_by === 'boda' && cx2.client_phone === null, 'Boda cancels while shopping');
ok((await q('c1', `select * from boda_locations`)).length === 0, 'location cleaned after a cancelled shopping order');
await online('b2');
const d3 = (await q('c1', `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`))[0];
await db.exec(`update rides set expires_at = now() - interval '1 second' where id='${d3.id}'`);
await fails('b2', `select accept_ride('${d3.id}')`, 'ride_expired');
await as('c1', () => db.query(`select sweep_rides()`));
ok((await db.query(`select status from rides where id='${d3.id}'`)).rows[0].status === 'expired', 'a shopping request expires like a ride');

console.log('\n# shopping: problem reports (every reason), raw-SQL guards');
async function deliveredOrder(client) {
  await online('b2');
  const x = (await q(client, `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: flour.id })}'::jsonb)`))[0];
  await q('b2', `select * from accept_ride('${x.id}')`);
  await q('b2', `select * from shopping_start('${x.id}')`);
  await q('b2', `select * from shopping_purchased('${x.id}', 200, true)`);
  await q('b2', `select * from shopping_deliver_start('${x.id}')`);
  return x;
}
const pr = await deliveredOrder('c1');
await fails('c1', `select report_ride_problem('${pr.id}', 'other')`, 'invalid_state');          // not delivered yet
await q('b2', `select * from shopping_complete('${pr.id}', 50, true)`);
await fails('c1', `select report_ride_problem('${pr.id}', 'nonsense')`, 'invalid_problem');
await fails('c1', `select report_ride_problem('${pr.id}', null)`, 'invalid_problem');
await fails('c2', `select report_ride_problem('${pr.id}', 'other')`, 'ride_not_found');
await fails('b2', `select report_ride_problem('${pr.id}', 'other')`, 'ride_not_found');
const rep = (await q('c1', `select * from report_ride_problem('${pr.id}', 'total_mismatch', '  total is 300 on the receipts  ')`))[0];
ok(rep.problem_reported && rep.problem_type === 'total_mismatch' && rep.problem_text === 'total is 300 on the receipts' && rep.problem_at && rep.suspect_reason.includes('problem_reported') && rep.suspect, 'problem recorded (type + text + time) and flagged');
await fails('c1', `select report_ride_problem('${pr.id}', 'other')`, 'already_reported');
const conf2 = (await q('c1', `select * from confirm_ride('${pr.id}', 2::smallint)`))[0];
ok(conf2.counted && conf2.problem_reported, 'the client can still confirm after reporting');
for (const reason of ['receipts_not_shown', 'missing_item', 'other']) {
  const o = await deliveredOrder('c1');
  await q('b2', `select * from shopping_complete('${o.id}', 0, true)`);
  const r = (await q('c1', `select * from report_ride_problem('${o.id}', '${reason}')`))[0];
  ok(r.problem_type === reason && r.problem_text === null, `problem reason ${reason}`);
}
// a plain ride has no problem report
await online('b2');
const plain = (await q('c1', `select * from request_ride('${ID.b2}', -1.0, 34.88)`))[0];
await fails('c1', `select report_ride_problem('${plain.id}', 'other')`, 'ride_not_found');
await q('c1', `select cancel_ride('${plain.id}')`);

// raw-SQL guards (superuser, bypassing the functions)
await online('b2');
const g2 = (await q('c1', `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${items({ catalog_item_id: sugar.id })}'::jsonb)`))[0];
for (const [sql, why] of [
  [`update rides set status='arrived' where id='${g2.id}'`, 'requested->arrived'],
  [`update rides set type='ride' where id='${g2.id}'`, 'type is immutable'],
  [`update rides set items_count=9 where id='${g2.id}'`, 'items_count is immutable'],
  [`update rides set items_total_kes=5 where id='${g2.id}'`, 'amount outside its step'],
  [`update rides set delivery_fee_kes=5 where id='${g2.id}'`, 'fee outside its step'],
  [`update rides set receipts_kept=true where id='${g2.id}'`, 'receipt flag outside its step'],
  [`update rides set problem_reported=true, problem_type='other' where id='${g2.id}'`, 'problem on a non-completed order'],
  [`update rides set status='shopping' where id='${g2.id}'`, 'requested->shopping'],
]) {
  try { await db.query(sql); ok(false, `should be refused: ${why}`); } catch (e) { ok(/invalid_|immutable/.test(e.message), `${why}: ${e.message}`); }
}
await q('b2', `select * from accept_ride('${g2.id}')`);
try { await db.query(`update rides set status='purchased' where id='${g2.id}'`); ok(false, 'accepted->purchased'); } catch (e) { ok(e.message.includes('invalid_transition'), 'accepted->purchased: ' + e.message); }
await db.exec(`update rides set status='shopping' where id='${g2.id}'`);
try { await db.query(`update rides set status='purchased', items_total_kes=10 where id='${g2.id}'`); ok(false, 'purchased without receipts'); } catch (e) { ok(e.message.includes('receipts_required'), 'database insists on receipts_kept: ' + e.message); }
try { await db.query(`update rides set status='purchased', receipts_kept=true where id='${g2.id}'`); ok(false, 'purchased without total'); } catch (e) { ok(e.message.includes('invalid_amount'), 'database insists on a total: ' + e.message); }
await q('c1', `select cancel_ride('${g2.id}')`);
// a ride cannot walk the shopping path
await online('b2');
const rr = (await q('c2', `select * from request_ride('${ID.b2}', -1.0, 34.88)`))[0];
await q('b2', `select accept_ride('${rr.id}')`);
try { await db.query(`update rides set status='shopping' where id='${rr.id}'`); ok(false, 'ride->shopping'); } catch (e) { ok(e.message.includes('invalid_transition'), 'a ride cannot become a shopping order: ' + e.message); }
await q('c2', `select cancel_ride('${rr.id}')`);

console.log('\n# shopping: admin numbers (rides and shopping are counted separately)');
const so = (await q('admin', `select admin_shopping_overview() as o`))[0].o;
const shopTotals = (await db.query(`select count(*)::int n, count(*) filter (where counted)::int c from rides where type='shopping'`)).rows[0];
ok(so.requests.total === shopTotals.n && so.counted.total === shopTotals.c, `shopping counters (${shopTotals.n} orders, ${shopTotals.c} counted)`);
ok(so.problems.reported === 4 && so.problem_types.total_mismatch === 1 && so.problem_types.receipts_not_shown === 1 && so.problem_types.missing_item === 1 && so.problem_types.other === 1, 'problems broken down by reason');
ok(so.avg_order_kes !== null && so.avg_delivery_fee_kes !== null, 'average order value + delivery fee');
ok(so.receipts.kept_pct === 100 && so.receipts.shown_pct === 100, 'receipts indicators');
ok(so.no_receipt_items_pct > 0 && so.no_receipt_items_pct < 100, `"no receipt" lines share (${so.no_receipt_items_pct}%)`);
ok(so.top_items[0].name_en === 'Sugar' && so.top_custom.some((x) => x.name === 'Krackers'), 'most requested articles + most frequent free articles');
const ov2 = (await q('admin', `select admin_overview() as o`))[0].o;
const rideReq = (await db.query(`select count(*)::int n from rides where type='ride' and requested_at >= date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'`)).rows[0].n;
ok(ov2.requests.today === rideReq, 'the existing overview counts rides only');
const serShop = await q('admin', `select * from admin_daily_series(3, 'shopping')`);
const serRide = await q('admin', `select * from admin_daily_series(3)`);
ok(serShop.at(-1).requests === shopTotals.n && serRide.at(-1).requests === rideReq + 0 || serRide.at(-1).requests > 0, 'daily series per type');
const bs = (await q('admin', `select * from admin_boda_stats()`)).find((x) => x.name === 'Wanjiru Boda');
ok(bs.shopping_orders > 0 && bs.receipts_kept_pct === 100 && bs.receipts_shown_pct === 100 && bs.no_receipt_pct !== null, 'per-Boda shopping + receipts indicators');
const probs = await q('admin', `select * from admin_shopping_problems()`);
ok(probs.length === 4 && probs.every((x) => Array.isArray(x.items) && x.items.length === 1 && x.client_phone === '+254711000001'), 'problem list with the order detail (client phone from the profile)');
await fails('c1', `select admin_shopping_overview()`, 'forbidden');
await fails('b2', `select admin_shopping_problems()`, 'forbidden');

console.log('\n# production-like: catalog_items created BY HAND before the shopping migration');
async function freshDb(upTo) {
  const d = new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;`);
  for (const m of MIGRATIONS.slice(0, upTo)) await d.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8'));
  return d;
}
const rest = MIGRATIONS.slice(3); // shopping migration + seed (the enum file, index 2, is run first)
async function applyRest(d) { for (const m of rest) await d.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8')); }
const asUser = async (d, id, sql) => { await d.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`); try { return (await d.query(sql)).rows; } finally { await d.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); } };

// A: like the real one (uuid pk, 7 columns, no created_at), RLS on, a permissive hand-made policy, their own categories
{
  const d = await freshDb(3);
  await d.exec(`
    create table public.catalog_items (id uuid primary key default gen_random_uuid(), name_en text, name_sw text, category text, unit text, active boolean default true, sort_order int);
    alter table public.catalog_items enable row level security;
    create policy "allow all" on public.catalog_items for all using (true) with check (true);
    grant all on public.catalog_items to anon, authenticated;
    insert into public.catalog_items (name_en, name_sw, category, unit, sort_order) values
      ('Sugar', 'Sukari', 'Alimentation de base', 'kg', 1), ('Sukuma wiki', 'Sukuma wiki', 'Frais', 'bunch', 2), ('Fish', 'Samaki', 'Frais', 'kg', 3);`);
  ok((await d.query(`select count(*)::int n from catalog_items`)).rows[0].n === 3, 'A: hand-made catalogue with 3 rows');
  await applyRest(d);
  const rows = (await d.query(`select * from catalog_items`)).rows;
  ok(rows.length === 27, `A: seed completes the catalogue without duplicating Sugar / Sukuma wiki (27 = 24 new + 3 yours, got ${rows.length})`);
  ok(rows.filter((r) => r.name_en === 'Sugar').length === 1 && rows.find((r) => r.name_en === 'Sugar').category === 'Alimentation de base', 'A: your rows are untouched (names, categories)');
  ok(rows.every((r) => r.active === true && r.created_at), 'A: created_at added, nothing deactivated');
  const pol = (await d.query(`select policyname from pg_policies where tablename = 'catalog_items' order by 1`)).rows.map((r) => r.policyname).join();
  ok(pol === 'catalog_read,catalog_read_anon', `A: the permissive hand-made policy is replaced by the two read policies (${pol})`);
  await d.exec(`set role anon`); const anonN = (await d.query(`select count(*)::int n from catalog_items`)).rows[0].n; await d.exec(`reset role`);
  ok(anonN === 27, 'A: anonymous visitors read the active articles');
  const cid = '00000000-0000-0000-0000-0000000000c1', bid = '00000000-0000-0000-0000-0000000000b1', aid = '00000000-0000-0000-0000-0000000000a1';
  await d.exec(`insert into auth.users values ('${cid}'), ('${bid}'), ('${aid}');
    insert into profiles (id, role, name, phone, language) values ('${cid}','client','Client','+254711000001','en'), ('${bid}','boda','Boda','+254700000001','en'), ('${aid}','admin','Admin',null,'en');
    insert into boda_profiles (user_id, plate, status) values ('${bid}','KMFA 123A','approved');`);
  let blocked = 0;
  for (const sql of [`insert into catalog_items (name_en, name_sw, category) values ('x','y','z')`, `update catalog_items set active = false`, `delete from catalog_items`]) {
    try { await asUser(d, cid, sql); } catch (e) { if (/permission denied/.test(e.message)) blocked++; }
  }
  ok(blocked === 3, 'A: a client can neither insert, update nor delete articles (the hand-made grants are revoked)');
  await asUser(d, bid, `select set_availability(true, -1.0, 34.88)`);
  const hand = (await d.query(`select id from catalog_items where name_en = 'Fish'`)).rows[0].id;
  const o = (await asUser(d, cid, `select * from request_shopping('${bid}', -1.0, 34.88, '[{"catalog_item_id":"${hand}","quantity":2},{"custom_name":"Krackers"}]'::jsonb)`))[0];
  const li = (await asUser(d, cid, `select name_en, unit, quantity, is_custom from ride_items where ride_id = '${o.id}' order by position`));
  ok(li.length === 2 && li[0].name_en === 'Fish' && li[0].unit === 'kg' && li[0].quantity === 2 && li[1].is_custom, 'A: a client creates an order with an article from the hand-made catalogue (lines written, snapshot taken)');
  ok((await asUser(d, bid, `select id from ride_items where ride_id = '${o.id}'`)).length === 2, 'A: the addressed Boda reads the lines');
  ok((await asUser(d, bid, `select count(*)::int n from catalog_items`))[0].n === 27, 'A: signed-in users read the catalogue');
  let direct = false; try { await asUser(d, cid, `insert into ride_items (ride_id, custom_name, is_custom) values ('${o.id}', 'forged', true)`); } catch (e) { direct = /permission denied/.test(e.message); }
  ok(direct, 'A: direct inserts into ride_items are refused (only request_shopping writes lines)');
  const before = (await d.query(`select count(*)::int n from catalog_items`)).rows[0].n;
  await applyRest(d);
  ok((await d.query(`select count(*)::int n from catalog_items`)).rows[0].n === before, 'A: running the migrations a second time changes nothing');
  const admin = (await asUser(d, aid, `select count(*)::int n from catalog_items`))[0].n;
  ok(admin === before, 'A: admin sees every article');
  await d.close();
}
// B: no primary key, no default, missing columns, NULL flags
{
  const d = await freshDb(3);
  await d.exec(`create table public.catalog_items (id uuid, name_en text, name_sw text, category text, active boolean);
    insert into public.catalog_items (id, name_en, name_sw, category, active) values (gen_random_uuid(), 'Fish', 'Samaki', 'fresh', null), (gen_random_uuid(), 'Rice', '', 'staples', true);`);
  await applyRest(d);
  const rows = (await d.query(`select * from catalog_items`)).rows;
  ok(rows.length === 27 && rows.filter((r) => r.name_en === 'Rice').length === 1, `B: table without key/default/unit/sort_order is completed (${rows.length} rows, no duplicate Rice)`);
  ok(rows.find((r) => r.name_en === 'Fish').active === true && rows.find((r) => r.name_en === 'Fish').unit === 'piece', 'B: NULL flags and missing columns get sane values');
  ok((await d.query(`select count(*)::int n from pg_index where indrelid = 'public.catalog_items'::regclass and indisprimary`)).rows[0].n === 1, 'B: a primary key on id was added');
  await d.close();
}
// C: an id of another type is refused with a clear message, nothing changed
{
  const d = await freshDb(3);
  await d.exec(`create table public.catalog_items (id bigint primary key, name_en text, name_sw text, category text, unit text, active boolean default true, sort_order int); insert into public.catalog_items values (1, 'Fish', 'Samaki', 'fresh', 'kg', true, 1);`);
  let msg = '';
  try { await applyRest(d); } catch (e) { msg = e.message; }
  ok(/catalog_items\.id is of type bigint/.test(msg), `C: bigint id -> explicit error (${msg.slice(0, 80)})`);
  ok((await d.query(`select count(*)::int n from catalog_items`)).rows[0].n === 1, 'C: the hand-made table is left as it was');
  await d.close();
}

console.log('\n# admin');
ok((await db.query(`select count(*)::int n from boda_daily_activity`)).rows[0].n > 0
   && (await q('c1', `select * from boda_daily_activity`)).length === 0, 'activity rows exist but are admin-only');
const ov = (await q('admin', `select admin_overview() as o`))[0].o;
console.log(JSON.stringify(ov));
ok(ov.counted.total >= 2 && ov.suspect.total >= 11 && ov.bodas.approved === 2, 'overview numbers');
const series = await q('admin', `select * from admin_daily_series(7)`);
ok(series.length === 7 && series.at(-1).requests > 0, 'series 7 days');
console.log(series.at(-1));
const stats = await q('admin', `select * from admin_boda_stats()`);
console.log(stats.map(s => [s.name, s.requests, s.responded, s.accepted, s.counted, s.suspect, s.avg_accept_seconds]));
ok(stats.length === 2, 'boda stats');
await as('admin', () => db.query(`select admin_set_boda_status('${ID.b2}','suspended')`));
await fails('b2', `select set_availability(true, -1, 34.8)`, 'boda_not_approved');
ok((await q('admin', `select * from rides`)).length > 10, 'admin reads all rides');

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
