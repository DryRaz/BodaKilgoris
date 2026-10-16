import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the real migration on an in-process Postgres (PGlite) and exercises
// RLS + the ride state machine. Usage: npm run test:db
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(here, '..', 'migrations', '20261016000000_init.sql');

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
await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
console.log('migration applied');

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
