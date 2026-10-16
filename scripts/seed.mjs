// Demo data: 5 Bodas + 3 clients (mixed EN / SW), live positions around Kilgoris and
// 14 days of ride history so the admin dashboard is not empty.
//
//   npm run seed                 first time (creates everything)
//   npm run seed -- --refresh    only refresh Bodas' positions/availability
//                                (positions older than 3 min are hidden, so re-run before a demo,
//                                 or keep `npm run simulate` running)
//
// Safe to re-run: existing users are reused, history is only generated if there are no rides.
// Sign-in for every demo Boda: phone below + PIN 1234. Clients sign in with name + phone only.
import { adminClient, bodaPassword, clientPassword, emailForPhone, loadEnv, requireEnv } from './lib/env.mjs';

loadEnv();
requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_PEPPER');
const refreshOnly = process.argv.includes('--refresh');
const admin = adminClient();

const CENTER = { lat: -1.0035, lng: 34.8767 };
const PIN = '1234';

const BODAS = [
  { name: 'Otieno Odhiambo',    phone: '+254711000001', plate: 'KMFA 101A', language: 'en', status: 'approved',  online: [0.0012, 0.0020] },
  { name: 'Nyaboke Moraa',      phone: '+254711000002', plate: 'KMFB 202B', language: 'sw', status: 'approved',  online: [-0.0030, 0.0035] },
  { name: 'Saitoti Ole Sanguya', phone: '+254711000003', plate: 'KMFC 303C', language: 'sw', status: 'approved', online: [0.0040, -0.0025] },
  { name: 'Barasa Wekesa',      phone: '+254711000004', plate: 'KMFD 404D', language: 'en', status: 'approved',  online: null }, // approved, offline
  { name: 'Naserian Lemayian',  phone: '+254711000005', plate: 'KMFE 505E', language: 'sw', status: 'pending',   online: null }, // waiting for admin
];
const CLIENTS = [
  { name: 'Amina Hassan',  phone: '+254722000001', language: 'sw' },
  { name: 'Grace Achieng', phone: '+254722000002', language: 'en' },
  { name: 'Peter Kiprono', phone: '+254722000003', language: 'sw' },
];
const DESTINATIONS = ['Kilgoris Market', 'Kilgoris Hospital', 'Bus stage', 'Sokoni', 'Kilgoris Girls High School', 'Church', 'Posta', 'Kilgoris Airstrip', 'Home - Mosiro Road', 'Shule ya Msingi'];

async function ensureUser({ phone, password, name, language, role, extra }) {
  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({ email: emailForPhone(phone), password, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const { error: pErr } = await admin.from('profiles').insert({ id, role, name, phone, language, geo_consent_at: new Date().toISOString() });
  if (pErr) throw pErr;
  if (extra) {
    const { error: eErr } = await admin.from(extra.table).insert({ user_id: id, ...extra.row });
    if (eErr) throw eErr;
  }
  return id;
}

// ---------------------------------------------------------------- users
const bodaIds = [];
for (const b of BODAS) {
  const id = await ensureUser({
    phone: b.phone, password: bodaPassword(b.phone, PIN), name: b.name, language: b.language, role: 'boda',
    extra: { table: 'boda_profiles', row: { plate: b.plate, status: b.status } },
  });
  bodaIds.push(id);
}
const clientIds = [];
for (const c of CLIENTS) {
  clientIds.push(await ensureUser({ phone: c.phone, password: clientPassword(c.phone), name: c.name, language: c.language, role: 'client' }));
}
console.log(`Users ready: ${BODAS.length} Bodas, ${CLIENTS.length} clients`);

// ---------------------------------------------------------------- live positions
async function refreshPositions() {
  for (const [i, b] of BODAS.entries()) {
    if (b.status !== 'approved') continue;
    if (b.online) {
      await admin.from('boda_profiles').update({ is_available: true, available_since: new Date().toISOString() }).eq('user_id', bodaIds[i]);
      await admin.from('boda_locations').upsert({
        boda_id: bodaIds[i], lat: CENTER.lat + b.online[0], lng: CENTER.lng + b.online[1], updated_at: new Date().toISOString(),
      });
    } else {
      await admin.from('boda_profiles').update({ is_available: false, available_since: null }).eq('user_id', bodaIds[i]);
      await admin.from('boda_locations').delete().eq('boda_id', bodaIds[i]);
    }
  }
}
await refreshPositions();
console.log('Positions refreshed (3 Bodas available around the town centre)');
if (refreshOnly) process.exit(0);

// ---------------------------------------------------------------- history
const { count } = await admin.from('rides').select('id', { count: 'exact', head: true });
if (count && count > 0) {
  console.log(`History skipped: ${count} rides already exist.`);
} else {
  let s = 20261016;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const approved = BODAS.map((b, i) => ({ ...b, id: bodaIds[i] })).filter((b) => b.status === 'approved');
  const clients = CLIENTS.map((c, i) => ({ ...c, id: clientIds[i] }));
  const NAIROBI = 3 * 3600_000;
  const startOfDay = (daysAgo) => {
    const d = new Date(Date.now() + NAIROBI);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() - NAIROBI - daysAgo * 86_400_000;
  };
  const jobs = [];
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const n = 3 + Math.round((13 - daysAgo) * 0.45) + Math.floor(rnd() * 4); // grows over the 2 weeks
    for (let i = 0; i < n; i++) {
      const at = startOfDay(daysAgo) + (6.5 + rnd() * 14) * 3600_000;
      if (at > Date.now() - 20 * 60_000) continue;
      jobs.push({ at, client: pick(clients), boda: pick(approved), kind: rnd() });
    }
  }
  // one suspicious pair: the same client and Boda "ride" 12 times in 3 hours yesterday
  for (let i = 0; i < 12; i++) {
    jobs.push({ at: startOfDay(1) + 9 * 3600_000 + i * 15 * 60_000, client: clients[1], boda: approved[3], kind: 0.3, forceFast: i % 3 === 0 });
  }
  jobs.sort((a, b) => a.at - b.at);

  let made = 0;
  for (const j of jobs) {
    const iso = (ms) => new Date(ms).toISOString();
    const { data: ride, error } = await admin.from('rides').insert({
      client_id: j.client.id, boda_id: j.boda.id,
      pickup_lat: CENTER.lat + (rnd() - 0.5) * 0.01, pickup_lng: CENTER.lng + (rnd() - 0.5) * 0.01,
      destination_text: pick(DESTINATIONS), requested_at: iso(j.at), expires_at: iso(j.at + 120_000),
      client_name: j.client.name, boda_name: j.boda.name, boda_plate: j.boda.plate,
    }).select('id').single();
    if (error) throw error;
    const upd = (patch) => admin.from('rides').update(patch).eq('id', ride.id).then(({ error: e }) => { if (e) throw e; });

    if (j.kind > 0.9) { await upd({ status: 'declined', declined_at: iso(j.at + 25_000) }); continue; }
    if (j.kind > 0.80) { await upd({ status: 'expired', expired_at: iso(j.at + 120_000) }); continue; }
    if (j.kind > 0.74) { await upd({ status: 'cancelled', cancelled_by: 'client', cancelled_at: iso(j.at + 40_000) }); continue; }

    const accepted = j.at + (15 + rnd() * 90) * 1000;
    await upd({ status: 'accepted', accepted_at: iso(accepted), client_phone: j.client.phone, boda_phone: j.boda.phone });
    const arrived = accepted + (2 + rnd() * 6) * 60_000;
    await upd({ status: 'arrived', arrived_at: iso(arrived) });
    const fast = j.forceFast || rnd() < 0.04;
    const completed = fast ? accepted + 70_000 : arrived + (4 + rnd() * 12) * 60_000;
    await upd({ status: 'completed', completed_at: iso(completed), agreed_price_kes: pick([50, 70, 100, 100, 150, 150, 200, 300]) });

    const recentlyDone = Date.now() - completed < 40 * 60_000;
    if (recentlyDone && rnd() < 0.5) continue; // still waiting for the client to confirm
    const auto = rnd() < 0.2;
    await upd({ client_confirmed: true, auto_confirmed: auto, rating: auto || rnd() < 0.3 ? null : 3 + Math.floor(rnd() * 3) });
    made++;
  }
  // "active Bodas per day" feeds from boda_daily_activity
  const rows = [];
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const day = new Date(startOfDay(daysAgo) + NAIROBI).toISOString().slice(0, 10);
    for (const b of approved) if (rnd() < 0.55 + (13 - daysAgo) * 0.025) {
      rows.push({ boda_id: b.id, day, first_online_at: new Date(startOfDay(daysAgo) + 7 * 3600_000).toISOString(), last_online_at: new Date(startOfDay(daysAgo) + 18 * 3600_000).toISOString(), pings: 400 + Math.floor(rnd() * 2000) });
    }
  }
  await admin.from('boda_daily_activity').upsert(rows, { onConflict: 'boda_id,day' });
  console.log(`History created: ${jobs.length} requests over 14 days (${made} confirmed rides)`);
}

console.log(`
Demo accounts
  Bodas (PIN ${PIN}):
${BODAS.map((b) => `    ${b.phone.replace('+254', '0')}  ${b.name.padEnd(20)} ${b.language}  ${b.status}${b.online ? '  (online)' : ''}`).join('\n')}
  Clients (name + phone, no password):
${CLIENTS.map((c) => `    ${c.phone.replace('+254', '0')}  ${c.name.padEnd(20)} ${c.language}`).join('\n')}
`);
