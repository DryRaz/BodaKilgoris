// Demo helper: keeps the available demo Bodas "alive" by moving them gently around Kilgoris
// every 10 s (random walk), so the live map and distances move while you present.
//   npm run simulate        (Ctrl+C to stop)
import { adminClient, loadEnv, requireEnv } from './lib/env.mjs';

loadEnv();
requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const admin = adminClient();
const CENTER = { lat: -1.0035, lng: 34.8767 };
const RADIUS = 0.006; // ~650 m

async function tick() {
  const { data: bodas } = await admin.from('boda_profiles').select('user_id').eq('is_available', true).eq('status', 'approved');
  const ids = (bodas ?? []).map((b) => b.user_id);
  if (ids.length === 0) return console.log('No available Boda. Run `npm run seed -- --refresh` first.');
  const { data: locs } = await admin.from('boda_locations').select('boda_id, lat, lng').in('boda_id', ids);
  for (const l of locs ?? []) {
    const lat = Math.max(CENTER.lat - RADIUS, Math.min(CENTER.lat + RADIUS, l.lat + (Math.random() - 0.5) * 0.0008));
    const lng = Math.max(CENTER.lng - RADIUS, Math.min(CENTER.lng + RADIUS, l.lng + (Math.random() - 0.5) * 0.0008));
    await admin.from('boda_locations').update({ lat, lng, updated_at: new Date().toISOString() }).eq('boda_id', l.boda_id);
  }
  console.log(new Date().toLocaleTimeString(), `moved ${locs?.length ?? 0} Bodas`);
}
console.log('Simulating movement every 10 s… (Ctrl+C to stop)');
await tick();
setInterval(() => tick().catch((e) => console.error(e.message)), 10_000);
