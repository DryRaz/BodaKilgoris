import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Admin alerts on sensitive terms: private, never blocking, whole words only. Usage: npm run test:db
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = fs.readdirSync(path.join(here, '..', 'migrations')).filter((f) => f.endsWith('.sql')).sort();

const db = new PGlite();
let failures = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { failures++; console.log('  ✗ FAIL:', msg); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const m of MIGRATIONS) await db.exec(fs.readFileSync(path.join(here, '..', 'migrations', m), 'utf8'));

const ID = { admin: '00000000-0000-0000-0000-0000000000a1', b2: '00000000-0000-0000-0000-0000000000b2',
  c1: '00000000-0000-0000-0000-0000000000c1', c2: '00000000-0000-0000-0000-0000000000c2' };
for (const id of Object.values(ID)) await db.exec(`insert into auth.users values ('${id}')`);
await db.exec(`
  insert into profiles (id, role, name, phone, language) values
   ('${ID.admin}','admin','Admin',null,'en'), ('${ID.b2}','boda','Wanjiru Boda','+254700000002','en'),
   ('${ID.c1}','client','Alice Client','+254711000001','en'), ('${ID.c2}','client','Baraka Mteja','+254711000002','sw');
  insert into boda_profiles (user_id, plate, status) values ('${ID.b2}','KMFB 456B','approved');`);

async function as(who, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ID[who]}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}
async function fails(who, sql, expected) {
  try { await as(who, () => db.query(sql)); return ok(false, `expected failure: ${sql}`); }
  catch (e) { ok(expected ? e.message.includes(expected) : true, `${sql} -> wrong error: ${e.message} (wanted ${expected})`); }
}
const q = (who, sql) => as(who, async () => (await db.query(sql)).rows);
const T = async (sql) => (await db.query(sql)).rows;

console.log('# the starting list and the settings');
const termRows = await T(`select category, count(*)::int n, bool_and(alert_enabled) all_on, bool_or(alert_enabled) any_on from private.blocked_terms group by category order by category`);
const byCat = Object.fromEntries(termRows.map((r) => [r.category, r]));
ok(termRows.reduce((a, r) => a + r.n, 0) === 85, 'starting list: 85 terms');
ok(byCat.alcohol.n === 31 && byCat.tobacco_drugs.n === 18 && byCat.health.n === 16 && byCat.money.n === 8 && byCat.danger.n === 6 && byCat.insult.n === 6, 'terms per category (31 / 18 / 16 / 8 / 6 / 6)');
ok(byCat.alcohol.all_on && byCat.tobacco_drugs.all_on && byCat.money.all_on && byCat.danger.all_on, 'alcohol, tobacco_drugs, money, danger: alert_enabled = true');
ok(!byCat.health.any_on && !byCat.insult.any_on, 'health and insult: alert_enabled = false by default');
ok((await T(`select key, value from app_settings where key in ('alerts_enabled','alerts_retention_days') order by key`)).map((r) => `${r.key}=${r.value}`).join() === 'alerts_enabled=1,alerts_retention_days=90', 'settings: alerts_enabled = 1, alerts_retention_days = 90');
ok((await T(`select public.normalize_item_name('  M-Pesa!!  Send  Money ') n`))[0].n === 'm pesa send money', 'normalize_item_name');
await db.exec(`select 1`);
ok((await T(`select count(*)::int n from private.blocked_terms where term in ('johnnie walker','kenya cane','captain morgan','chang aa','m pesa','send money','kumi kumi')`))[0].n === 7, 'multi-word terms are in the list');

console.log('\n# nobody but the admin can reach, count or detect the data');
for (const who of ['c1', 'b2']) {
  await fails(who, `select * from private.admin_alerts`, 'permission denied');
  await fails(who, `select count(*) from private.admin_alerts`, 'permission denied');
  await fails(who, `select * from private.blocked_terms`, 'permission denied');
  await fails(who, `select * from private.error_log`, 'permission denied');
  await fails(who, `select * from private.alert_daily_counts`, 'permission denied');
  await fails(who, `select private.alerts_retention(true)`, 'permission denied');
  await fails(who, `select admin_alerts_count()`, 'forbidden');
  await fails(who, `select * from admin_alerts_list()`, 'forbidden');
  await fails(who, `select * from admin_alerts_by_client()`, 'forbidden');
  await fails(who, `select admin_test_text('tusker')`, 'forbidden');
  await fails(who, `select admin_alert_settings()`, 'forbidden');
  await fails(who, `select admin_set_setting('alerts_enabled', 0)`, 'forbidden');
  await fails(who, `select admin_save_term(null, 'zzz', 'alcohol')`, 'forbidden');
  await fails(who, `select admin_set_alert('00000000-0000-0000-0000-000000000001', 'handled')`, 'forbidden');
  await fails(who, `select public.normalize_item_name('x')`, 'permission denied');
}
await db.exec(`set role anon`);
for (const sql of [`select * from private.admin_alerts`, `select admin_alerts_count()`, `select * from private.blocked_terms`]) {
  try { await db.query(sql); ok(false, 'anon ' + sql); } catch (e) { ok(/permission denied/.test(e.message), 'anon refused: ' + sql); }
}
await db.exec(`reset role`);
ok((await T(`select count(*)::int n from pg_publication_tables where schemaname = 'private'`))[0].n === 0, 'no private table is published (Realtime cannot carry alerts)');
ok((await T(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in ('admin_alerts', 'blocked_terms', 'error_log')`))[0].n === 0, 'nothing named admin_alerts / blocked_terms / error_log in the exposed schema');

console.log('\n# detection');
async function online() { await as('b2', () => db.query(`select set_availability(true, -1.0, 34.88)`)); }
async function mk(client, items, note = null) {
  await online();
  const body = JSON.stringify(items).replace(/'/g, "''");
  return (await q(client, `select * from request_shopping('${ID.b2}', -1.0, 34.88, '${body}'::jsonb, null, ${note === null ? 'null' : `'${note.replace(/'/g, "''")}'`})`))[0];
}
const drop = (client, ride) => q(client, `select cancel_ride('${ride.id}')`);
const alerts = (rideId) => T(`select a.category, a.source, a.matched_text, a.status, t.term from private.admin_alerts a left join private.blocked_terms t on t.id = a.term_id where a.ride_id = '${rideId}' order by t.term`);

// (a)
const orderA = await mk('c1', [{ custom_name: '2 bottles of Tusker', quantity: 2 }, { custom_name: 'Sugar 2kg' }]);
ok(orderA.status === 'requested' && orderA.items_count === 2 && orderA.type === 'shopping', '(a) the order is created normally (same row, same status)');
const alertsA = await alerts(orderA.id);
ok(alertsA.length === 1 && alertsA[0].category === 'alcohol' && alertsA[0].term === 'tusker' && alertsA[0].source === 'item' && alertsA[0].matched_text === '2 bottles of Tusker' && alertsA[0].status === 'new', '(a) one alcohol alert with the exact text typed');
ok((await q('c1', `select count(*)::int n from ride_items where ride_id = '${orderA.id}'`))[0].n === 2 && (await q('b2', `select id from rides where id='${orderA.id}'`)).length === 1, '(a) client and Boda read the order and its lines as before');
const accA = (await q('b2', `select * from accept_ride('${orderA.id}')`))[0];
await q('b2', `select shopping_start('${orderA.id}')`); await q('b2', `select shopping_purchased('${orderA.id}', 500, true)`);
await q('b2', `select shopping_deliver_start('${orderA.id}')`); await q('b2', `select shopping_complete('${orderA.id}', 50, true)`);
const confA = (await q('c1', `select * from confirm_ride('${orderA.id}', 5::smallint)`))[0];
ok(accA.status === 'accepted' && confA.counted && confA.status === 'completed', '(a)/(k) the flagged order runs the whole lifecycle and is counted');

// (b)
const orderB1 = await mk('c2', [{ custom_name: 'ginger' }, { custom_name: 'drum' }, { custom_name: 'gunia' }, { custom_name: 'wineglass' }]);
ok((await alerts(orderB1.id)).length === 0, '(b) "ginger", "drum", "gunia", "wineglass": no alert');
await drop('c2', orderB1);
const orderB2 = await mk('c2', [{ custom_name: 'gin' }, { custom_name: 'Rum' }, { custom_name: 'gun' }, { custom_name: 'a bottle of kenya cane' }, { custom_name: 'M-Pesa float' }]);
const gotB2 = (await alerts(orderB2.id)).map((x) => `${x.term}:${x.category}`).sort().join();
ok(gotB2 === 'gin:alcohol,gun:danger,kenya cane:alcohol,m pesa:money,pesa:money,rum:alcohol', `(b) "gin", "rum", "gun", "kenya cane" (2 words), "M-Pesa": alerts (${gotB2})`);
await drop('c2', orderB2);

// (c)
const orderC1 = await mk('c1', [{ custom_name: 'Amoxicillin 500mg' }]);
ok((await alerts(orderC1.id)).length === 0, '(c) health term with alert_enabled = false: no alert');
await drop('c1', orderC1);
const amox = (await T(`select id from private.blocked_terms where term = 'amoxicillin'`))[0].id;
await as('admin', () => db.query(`select admin_save_term('${amox}', 'amoxicillin', 'health', true, true)`));
const orderC2 = await mk('c1', [{ custom_name: 'Amoxicillin 500mg' }]);
const alertsC2 = await alerts(orderC2.id);
ok(alertsC2.length === 1 && alertsC2[0].category === 'health', '(c) after the admin enables it: the alert appears for new entries');
ok((await alerts(orderC1.id)).length === 0, '(c) no retroactive alert on the earlier order');
await drop('c1', orderC2);

// (d)
const orderD = await mk('c2', [{ custom_name: 'Sugar' }], 'please send money to my brother');
const alertsD = await alerts(orderD.id);
ok(alertsD.length === 1 && alertsD[0].source === 'client_note' && alertsD[0].category === 'money' && alertsD[0].matched_text === 'please send money to my brother' && alertsD[0].term === 'send money', '(d) term in client_note: alert with source = client_note');
await drop('c2', orderD);

// (e)
const orderE = await mk('c1', [{ custom_name: 'tusker' }, { custom_name: 'Tusker!' }, { custom_name: 'TUSKER   lager' }], 'tusker tusker');
const gotE = (await alerts(orderE.id)).map((x) => `${x.term}/${x.source}`).sort().join();
ok(gotE === 'lager/item,tusker/client_note,tusker/item', `(e) same article typed 3 times = one alert; the note is its own event (${gotE})`);
await drop('c1', orderE);
const one = (await T(`select ride_item_id, term_id from private.admin_alerts where ride_item_id is not null limit 1`))[0];
let dupErr = '';
try { await db.query(`insert into private.admin_alerts (ride_id, ride_item_id, client_id, term_id, category, source) select ride_id, ride_item_id, client_id, term_id, category, source from private.admin_alerts where ride_item_id = '${one.ride_item_id}' and term_id = '${one.term_id}'`); } catch (e) { dupErr = e.message; }
ok(/duplicate key/.test(dupErr), '(e) the database itself refuses a second alert for the same line + term');

// (f)
await db.exec(`alter table private.admin_alerts add constraint boom check (false) not valid`);
const orderF = await mk('c2', [{ custom_name: 'whisky' }], 'vodka');
ok(orderF.status === 'requested' && (await T(`select count(*)::int n from ride_items where ride_id='${orderF.id}'`))[0].n === 1, '(f) detection forced to fail: the order and its lines are saved');
const logRows = await T(`select source, message from private.error_log order by id desc limit 3`);
ok(logRows.length >= 2 && logRows.some((x) => x.source === 'alert_scan_item') && logRows.some((x) => x.source === 'alert_scan_note'), `(f) the failures are logged in error_log (${logRows.map((x) => x.source).join()})`);
ok((await alerts(orderF.id)).length === 0, '(f) no alert recorded for it');
await db.exec(`alter table private.admin_alerts drop constraint boom`);
await drop('c2', orderF);

// (i)
await as('admin', () => db.query(`select admin_set_setting('alerts_enabled', 0)`));
const orderI1 = await mk('c1', [{ custom_name: 'tusker' }], 'gun');
ok((await alerts(orderI1.id)).length === 0, '(i) alerts_enabled = 0 stops everything (item and note)');
await drop('c1', orderI1);
await as('admin', () => db.query(`select admin_set_setting('alerts_enabled', 1)`));
await as('admin', () => db.query(`select admin_set_setting('alerts_category_alcohol', 0)`));
const orderI2 = await mk('c1', [{ custom_name: 'tusker' }, { custom_name: 'poison' }]);
ok((await alerts(orderI2.id)).map((x) => x.category).join() === 'danger', '(i) a category switch off: only that category is silent');
await drop('c1', orderI2);
await as('admin', () => db.query(`select admin_set_setting('alerts_category_alcohol', 1)`));
const tusk = (await T(`select id from private.blocked_terms where term = 'tusker'`))[0].id;
await as('admin', () => db.query(`select admin_save_term('${tusk}', 'tusker', 'alcohol', false, true)`));
const orderI3 = await mk('c1', [{ custom_name: 'tusker' }, { custom_name: 'guinness' }]);
ok((await alerts(orderI3.id)).map((x) => x.term).join() === 'guinness', '(i) a term with alert_enabled = false is silent, the others still alert');
await drop('c1', orderI3);
await as('admin', () => db.query(`select admin_save_term('${tusk}', 'tusker', 'alcohol', true, false)`));
const orderI4 = await mk('c1', [{ custom_name: 'tusker' }]);
ok((await alerts(orderI4.id)).length === 0, '(i) an inactive term is silent');
await drop('c1', orderI4);
await as('admin', () => db.query(`select admin_save_term('${tusk}', 'tusker', 'alcohol', true, true)`));
await fails('admin', `select admin_set_setting('promote_enabled', 0)`, 'invalid_setting');
await fails('admin', `select admin_set_setting('alerts_enabled', 5)`, 'invalid_setting');
await fails('admin', `select admin_set_setting('alerts_retention_days', 0)`, 'invalid_setting');
await fails('admin', `select admin_save_term(null, '!!', 'alcohol')`, 'invalid_term');
await fails('admin', `select admin_save_term(null, 'beer', 'alcohol')`, 'term_exists');
await fails('admin', `select admin_save_term(null, 'x', 'sports')`, 'invalid_term');
const newTerm = (await q('admin', `select admin_save_term(null, ' Sambuca ', 'alcohol', true, true) t`))[0].t;
ok(newTerm.term === 'sambuca' && newTerm.category === 'alcohol', 'admin adds a term with its category and alert switch');
const orderI5 = await mk('c1', [{ custom_name: 'a Sambuca please' }]);
ok((await alerts(orderI5.id)).length === 1, 'a term added by the admin works on the next order');
await drop('c1', orderI5);

console.log('\n# what the admin sees');
const badge = (await q('admin', `select admin_alerts_count() n`))[0].n;
const newN = (await T(`select count(*)::int n from private.admin_alerts where status = 'new'`))[0].n;
ok(badge === newN && badge >= 8, `admin badge count = alerts with status new (${badge})`);
const list = await q('admin', `select * from admin_alerts_list()`);
ok(list.length === (await T(`select count(*)::int n from private.admin_alerts`))[0].n && list[0].created_at >= list.at(-1).created_at, 'admin list: most recent first');
const tusker1 = list.find((x) => x.matched_text === '2 bottles of Tusker');
ok(tusker1.client_name === 'Alice Client' && tusker1.client_phone === '+254711000001' && tusker1.ride_type === 'shopping' && tusker1.term === 'tusker' && tusker1.ride_id === orderA.id, 'admin list: text, client name + phone, order link, matched term');
const alco = list.filter((x) => x.client_id === ID.c1 && x.category === 'alcohol').sort((a, b) => a.created_at - b.created_at);
ok(alco.at(-1).recent_count === alco.length && alco.length >= 3, `recurrence counter ("${alco.length}th alcohol alert in 30 days")`);
ok((await q('admin', `select * from admin_alerts_list('new', 'money')`)).every((x) => x.category === 'money' && x.status === 'new'), 'admin list: filters by status and category');
const byClient = await q('admin', `select * from admin_alerts_by_client(90)`);
ok(byClient.length === 2 && byClient.find((x) => x.client_id === ID.c1).by_category.alcohol >= 3, 'admin list: grouped by client with a count per category');
await q('admin', `select admin_set_alert('${tusker1.id}', 'seen')`);
await q('admin', `select admin_set_alert('${tusker1.id}', 'handled', '  spoke to him, ok  ')`);
const handled = (await T(`select status, admin_note, handled_at from private.admin_alerts where id='${tusker1.id}'`))[0];
ok(handled.status === 'handled' && handled.admin_note === 'spoke to him, ok' && handled.handled_at, 'admin actions: seen, handled, private note');
await fails('admin', `select admin_set_alert('${tusker1.id}', 'weird')`, 'invalid_alert');
const test1 = (await q('admin', `select admin_test_text('Two bottles of Tusker and ginger') t`))[0].t;
ok(test1.would_alert === true && test1.matches.length === 1 && test1.matches[0].category === 'alcohol', 'test a text: matches + category + would alert');
const test2 = (await q('admin', `select admin_test_text('diazepam') t`))[0].t;
ok(test2.matches.length === 1 && test2.matches[0].would_alert === false && test2.would_alert === false && test2.matches[0].term_alert === false, 'test a text: a health term that is switched off matches but would not alert');
const settings = (await q('admin', `select admin_alert_settings() s`))[0].s;
ok(settings.alerts_enabled == 1 && settings.retention_days == 90 && Object.keys(settings.categories).length === 6 && settings.terms.length === 86, 'settings screen data (switch, retention, 6 categories, 86 terms)');

console.log('\n# retention (j)');
await db.exec(`insert into private.admin_alerts (ride_id, client_id, term_id, category, source, matched_text, admin_note, status, created_at, handled_at)
  select '${orderA.id}', '${ID.c1}', t.id, 'alcohol', 'item', 'old handled text', 'old note', 'handled', now() - interval '120 days', now() - interval '110 days' from private.blocked_terms t where term = 'beer'`);
await db.exec(`insert into private.admin_alerts (ride_id, client_id, term_id, category, source, matched_text, admin_note, status, created_at)
  select '${orderA.id}', '${ID.c1}', t.id, 'alcohol', 'item', 'old open text', 'old open note', 'new', now() - interval '120 days' from private.blocked_terms t where term = 'wine'`);
await db.exec(`insert into private.admin_alerts (ride_id, client_id, term_id, category, source, matched_text, status, created_at, handled_at)
  select '${orderA.id}', '${ID.c1}', t.id, 'alcohol', 'item', 'recent handled', 'dismissed', now() - interval '10 days', now() - interval '9 days' from private.blocked_terms t where term = 'cider'`);
const alBefore = (await T(`select count(*)::int n from private.admin_alerts`))[0].n;
const retRes = (await T(`select private.alerts_retention(true) r`))[0].r;
const retLeft = await T(`select matched_text, admin_note, status from private.admin_alerts where matched_text like 'old%' or admin_note like 'old%' or matched_text = 'recent handled' or (matched_text is null and created_at < now() - interval '100 days')`);
ok(retRes.deleted === 1 && retRes.wiped === 1, `retention ran (deleted ${retRes.deleted}, wiped ${retRes.wiped})`);
ok(!retLeft.some((x) => x.matched_text === 'old handled text'), '(j) an old handled alert is deleted');
ok(retLeft.some((x) => x.matched_text === null && x.admin_note === null && x.status === 'new'), '(j) an old OPEN alert stays but loses its text and its private note');
ok(retLeft.some((x) => x.matched_text === 'recent handled'), '(j) a recent handled alert is kept');
ok((await T(`select count(*)::int n from private.admin_alerts`))[0].n === alBefore - 1, '(j) nothing else was deleted');
ok((await T(`select coalesce(sum(n),0)::int n from private.alert_daily_counts`))[0].n >= 8, '(j) aggregate counters are kept');
ok((await T(`select private.alerts_retention() r`))[0].r.skipped === true, 'retention runs at most once per day on its own');
await db.exec(`update private.job_state set last_run = now() - interval '2 days'`);
await q('c1', `select sweep_rides()`);
ok((await T(`select last_run > now() - interval '1 minute' as fresh from private.job_state where key = 'alerts_retention'`))[0].fresh, 'sweep_rides() triggers the daily retention when it is due (no pg_cron needed)');

console.log('\n# first-order notice');
ok((await q('c1', `select notice_shown_at from profiles where id = '${ID.c1}'`))[0].notice_shown_at === null, 'notice: not shown yet');
await q('c1', `select record_notice(false)`);
let notice = (await q('c1', `select notice_shown_at, notice_accepted_at from profiles where id = '${ID.c1}'`))[0];
ok(notice.notice_shown_at && notice.notice_accepted_at === null, 'notice: closed without ticking = shown, not accepted');
await q('c1', `select record_notice(true)`);
notice = (await q('c1', `select notice_shown_at, notice_accepted_at from profiles where id = '${ID.c1}'`))[0];
ok(notice.notice_accepted_at, 'notice: "I understand" is recorded (notice_accepted_at)');
ok((await q('c2', `select notice_accepted_at from profiles where id = '${ID.c2}'`))[0].notice_accepted_at === null, 'notice: other clients unaffected');
await fails('c1', `update profiles set notice_accepted_at = null`, 'permission denied');

console.log('\n# nothing else moved');
const ov = (await q('admin', `select admin_overview() o`))[0].o;
ok(typeof ov.counted.total === 'number' && typeof ov.counted.today === 'number' && ov.counted_clean && ov.completed && ov.requests, 'admin_overview keeps its shape');
ok(!JSON.stringify(ov).includes('alert') && !JSON.stringify((await q('admin', `select admin_shopping_overview() o`))[0].o).includes('alert'), 'alerts are in no counter');
const cols = (await T(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'rides'`)).map((c) => c.column_name);
ok(!cols.some((c) => /alert/.test(c)), 'no alert column was added to rides (so the CSV export cannot carry one)');
ok((await T(`select count(*)::int n from pg_trigger where tgrelid = 'public.ride_items'::regclass and tgname = 'ride_items_alert_trg'`))[0].n === 1, 'one AFTER INSERT trigger on ride_items');

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
