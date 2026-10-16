// Creates (or promotes) the admin account.
//   npm run create-admin -- you@example.com 'a-strong-password' "Your Name"
import { adminClient, loadEnv, requireEnv } from './lib/env.mjs';

loadEnv();
requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npm run create-admin -- <email> <password (10+ chars)> [name]');
  process.exit(1);
}

const admin = adminClient();
let userId;
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  if (!/already|exists|registered/i.test(error.message)) throw error;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, { password });
  console.log('User already existed: password updated.');
} else {
  userId = created.user.id;
}

const { error: profileErr } = await admin
  .from('profiles')
  .upsert({ id: userId, role: 'admin', name, language: 'en' }, { onConflict: 'id' });
if (profileErr) throw profileErr;
console.log(`Admin ready: ${email}\nSign in at /admin/login`);
