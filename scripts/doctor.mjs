// Diagnoses a Supabase project against what the app needs. Read-only: it changes nothing.
//   npm run doctor            (reads .env.local, same variables as the app)
// Every ✗ line says exactly what to fix and where.
import { adminClient, loadEnv } from './lib/env.mjs';

loadEnv();
const env = process.env;
let problems = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m, fix) => { problems++; console.log(`  ✗ ${m}\n      → ${fix}`); };

console.log('\n1. Environment variables (as read by this shell; Vercel has its own copy)');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = env.AUTH_PEPPER;
url && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) ? ok(`NEXT_PUBLIC_SUPABASE_URL = ${url}`)
  : bad('NEXT_PUBLIC_SUPABASE_URL missing or not like https://<ref>.supabase.co', 'Supabase → Project settings → API → Project URL');
anon ? ok(`NEXT_PUBLIC_SUPABASE_ANON_KEY set (${anon.slice(0, 14)}…)`) : bad('NEXT_PUBLIC_SUPABASE_ANON_KEY missing', 'Supabase → Project settings → API → anon / publishable key');
service ? ok('SUPABASE_SERVICE_ROLE_KEY set') : bad('SUPABASE_SERVICE_ROLE_KEY missing', 'Supabase → Project settings → API → service_role (secret)');
pepper && pepper.length >= 16 ? ok(`AUTH_PEPPER set (${pepper.length} chars)`) : bad('AUTH_PEPPER missing or shorter than 16 chars', 'generate once with: openssl rand -hex 32 (never change it afterwards)');
if (!url || !anon || !service) { console.log('\nCannot continue without the variables above.'); process.exit(1); }

console.log('\n2. Auth configuration (public endpoint /auth/v1/settings)');
try {
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anon } });
  if (!res.ok) bad(`/auth/v1/settings answered ${res.status}`, 'the anon key is wrong or does not belong to this project');
  else {
    const s = await res.json();
    s.external?.email
      ? ok('Email provider ENABLED (required: Bodas/clients sign in through it, with a derived password)')
      : bad('Email provider is DISABLED → every sign-in fails with "422 Email logins are disabled" and the app shows "Something went wrong"',
          'Supabase → Authentication → Sign In / Providers → Email → switch "Enable Email provider" ON, then Save');
    s.disable_signup
      ? ok('Public sign-ups are disabled (good: accounts are only created by the server)')
      : console.log('  ! Public sign-ups are still allowed. Recommended: Authentication → Sign In / Providers → "Allow new users to sign up" OFF (this does NOT affect the app).');
    s.mailer_autoconfirm ? ok('Email auto-confirm on') : console.log('  · "Confirm email" is on: fine, the server creates users already confirmed.');
  }
} catch (e) { bad(`cannot reach ${url}: ${e.message}`, 'check the URL and your network'); }

console.log('\n3. Database (service role)');
const db = adminClient();
const TABLES = ['supported_languages', 'app_settings', 'profiles', 'boda_profiles', 'boda_locations', 'boda_daily_activity', 'rides', 'boda_passes'];
for (const t of TABLES) {
  const { error } = await db.from(t).select('*', { head: true, count: 'exact' });
  error ? bad(`table ${t}: ${error.message} (${error.code ?? 'no code'})`,
    error.code === '42P01' || /does not exist|schema cache/i.test(error.message)
      ? 'run supabase/migrations/20261016000000_init.sql in the SQL editor (or supabase/finish_setup.sql if partially applied)'
      : /JWT|apikey|invalid/i.test(error.message) ? 'SUPABASE_SERVICE_ROLE_KEY is wrong / from another project' : 'see the message above')
    : ok(`table ${t}`);
}
const { data: admins, error: adminErr } = await db.from('profiles').select('id').eq('role', 'admin');
if (!adminErr) admins?.length ? ok(`${admins.length} admin profile(s)`) : bad('no admin profile', "create the user in Authentication → Users, then: insert into profiles (id, role, name) select id, 'admin', 'Admin' from auth.users where email = '<your email>';");

console.log('\n4. RPC functions (sign-in is not needed: checked with the service role)');
for (const fn of ['setting_num', 'sweep_rides', 'available_bodas', 'request_ride', 'complete_ride', 'admin_overview']) {
  const probe = fn === 'setting_num' ? { p_key: 'x', p_default: 1 } : fn === 'request_ride' ? { p_boda_id: '00000000-0000-0000-0000-000000000000', p_lat: 0, p_lng: 0 } : fn === 'complete_ride' ? { p_ride_id: '00000000-0000-0000-0000-000000000000' } : {};
  const { error } = await db.rpc(fn, probe);
  // a business error (not_authenticated, forbidden, ride_not_found…) proves the function exists
  /could not find the function|does not exist|schema cache/i.test(error?.message ?? '')
    ? bad(`function ${fn} missing`, 'run supabase/finish_setup.sql in the SQL editor')
    : ok(`function ${fn}`);
}

console.log('\n5. Storage');
const { data: buckets } = await db.storage.listBuckets();
buckets?.some((b) => b.id === 'boda-photos') ? ok('bucket boda-photos') : bad('bucket boda-photos missing (Boda registration uploads a photo)', 'run the last block of the migration (storage.buckets insert) or create a PUBLIC bucket named boda-photos');

console.log(problems ? `\n${problems} problem(s) found: fix the ✗ lines above, then run again.` : '\nAll checks passed.');
process.exit(problems ? 1 : 0);
