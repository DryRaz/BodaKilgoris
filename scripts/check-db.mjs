// Read-only check of which migrations a Supabase project has. Uses only the public (anon / publishable) key,
// exactly like a visitor's browser, and writes nothing.
//   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run check:db
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (the same values as the app).');
  process.exit(2);
}

async function probe(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => null);
  if (res.ok) return { exists: true, anonRows: Array.isArray(body) ? body.length : 0 };
  if (body?.code === 'PGRST205') return { exists: false };
  if (body?.code === '42501') return { exists: true, anonDenied: true }; // table exists, anon has no SELECT grant
  return { exists: null, error: `${res.status} ${body?.code ?? ''} ${body?.message ?? ''}` };
}

const checks = [
  ['rides', '20261016000000_init.sql'],
  ['places', '20261020000000_optional_destination_places.sql'],
  ['catalog_items', '20261021000100_shopping.sql (after 20261021000000_shopping_status_values.sql)'],
  ['ride_items', '20261021000100_shopping.sql'],
];
let missing = 0;
for (const [table, migration] of checks) {
  const r = await probe(table);
  const state = r.exists === false ? 'MISSING' : r.exists ? 'ok' : `?? ${r.error}`;
  if (r.exists === false) missing++;
  console.log(`${state.padEnd(8)} ${table.padEnd(14)} ${r.exists === false ? '← run ' + migration : ''}`);
}
const cat = await probe('catalog_items');
if (cat.exists) {
  console.log(cat.anonDenied
    ? 'note     catalog_items: anonymous read not granted yet → run 20261021000100_shopping.sql, then 20261022000000_catalog_seed_and_public_read.sql'
    : cat.anonRows > 0 ? 'ok       catalog_items has articles visible to anonymous visitors'
      : 'WARNING  catalog_items is readable but returns NO active article (empty table, or row-level security without a read policy) → run 20261021000100_shopping.sql (it adapts to an existing table and adds the policies), then 20261022000000_catalog_seed_and_public_read.sql');
}
process.exit(missing ? 1 : 0);
