-- =============================================================================
-- Boda Kilgoris — catalogue seed (idempotent) + public read of active articles.
-- Run AFTER 20261021000100_shopping.sql. Safe to run any number of times:
--   * the 26 starting articles use fixed ids and ON CONFLICT DO NOTHING (an article the admin renamed, reordered or
--     hidden is never duplicated or re-activated); the NOT EXISTS guard also covers a catalogue that was seeded
--     earlier with random ids (same category + same English name = already there).
--   * clients — signed in or not — can READ active articles; only the admin can read hidden ones or write anything.
-- =============================================================================
insert into public.catalog_items (id, name_en, name_sw, category, unit, active, sort_order)
select v.id, v.name_en, v.name_sw, v.category, v.unit, true, v.sort_order
from (values
  ('c0a7a100-0000-4000-8000-000000000001'::uuid, 'Sugar', 'Sukari', 'staples', 'kg', 10),
  ('c0a7a100-0000-4000-8000-000000000002'::uuid, 'Maize flour', 'Unga', 'staples', 'kg', 20),
  ('c0a7a100-0000-4000-8000-000000000003'::uuid, 'Rice', 'Mchele', 'staples', 'kg', 30),
  ('c0a7a100-0000-4000-8000-000000000004'::uuid, 'Cooking oil', 'Mafuta ya kupikia', 'staples', 'litre', 40),
  ('c0a7a100-0000-4000-8000-000000000005'::uuid, 'Salt', 'Chumvi', 'staples', 'packet', 50),
  ('c0a7a100-0000-4000-8000-000000000006'::uuid, 'Tea leaves', 'Majani ya chai', 'staples', 'packet', 60),
  ('c0a7a100-0000-4000-8000-000000000007'::uuid, 'Bread', 'Mkate', 'staples', 'piece', 70),
  ('c0a7a100-0000-4000-8000-000000000008'::uuid, 'Eggs', 'Mayai', 'staples', 'piece', 80),
  ('c0a7a100-0000-4000-8000-000000000009'::uuid, 'Milk', 'Maziwa', 'staples', 'litre', 90),
  ('c0a7a100-0000-4000-8000-000000000010'::uuid, 'Tomatoes', 'Nyanya', 'fresh', 'kg', 110),
  ('c0a7a100-0000-4000-8000-000000000011'::uuid, 'Onions', 'Vitunguu', 'fresh', 'kg', 120),
  ('c0a7a100-0000-4000-8000-000000000012'::uuid, 'Potatoes', 'Viazi', 'fresh', 'kg', 130),
  ('c0a7a100-0000-4000-8000-000000000013'::uuid, 'Sukuma wiki', 'Sukuma wiki', 'fresh', 'bunch', 140),
  ('c0a7a100-0000-4000-8000-000000000014'::uuid, 'Cabbage', 'Kabichi', 'fresh', 'piece', 150),
  ('c0a7a100-0000-4000-8000-000000000015'::uuid, 'Bananas', 'Ndizi', 'fresh', 'bunch', 160),
  ('c0a7a100-0000-4000-8000-000000000016'::uuid, 'Bar soap', 'Sabuni', 'home', 'piece', 210),
  ('c0a7a100-0000-4000-8000-000000000017'::uuid, 'Washing powder', 'Omo', 'home', 'packet', 220),
  ('c0a7a100-0000-4000-8000-000000000018'::uuid, 'Toilet paper', 'Karatasi ya choo', 'home', 'piece', 230),
  ('c0a7a100-0000-4000-8000-000000000019'::uuid, 'Matches', 'Kibiriti', 'home', 'packet', 240),
  ('c0a7a100-0000-4000-8000-000000000020'::uuid, 'Candles', 'Mishumaa', 'home', 'packet', 250),
  ('c0a7a100-0000-4000-8000-000000000021'::uuid, 'Charcoal', 'Makaa', 'energy', 'kg', 310),
  ('c0a7a100-0000-4000-8000-000000000022'::uuid, 'Paraffin', 'Mafuta ya taa', 'energy', 'litre', 320),
  ('c0a7a100-0000-4000-8000-000000000023'::uuid, 'Gas refill', 'Gesi', 'energy', 'piece', 330),
  ('c0a7a100-0000-4000-8000-000000000024'::uuid, 'Drinking water', 'Maji ya kunywa', 'misc', 'litre', 410),
  ('c0a7a100-0000-4000-8000-000000000025'::uuid, 'Airtime', 'Mkopo wa simu', 'misc', 'ksh', 420),
  ('c0a7a100-0000-4000-8000-000000000026'::uuid, 'Painkillers', 'Dawa ya maumivu', 'misc', 'packet', 430)
) as v(id, name_en, name_sw, category, unit, sort_order)
where not exists (
  select 1 from public.catalog_items c where c.category = v.category and lower(c.name_en) = lower(v.name_en))
on conflict do nothing;

-- read access: anonymous visitors see active articles only; signed-in users the same, the admin everything
revoke all on public.catalog_items from anon, authenticated;
grant select on public.catalog_items to anon, authenticated;

drop policy if exists catalog_read on public.catalog_items;
create policy catalog_read on public.catalog_items
  for select to authenticated using (active or public.is_admin());
drop policy if exists catalog_read_anon on public.catalog_items;
create policy catalog_read_anon on public.catalog_items
  for select to anon using (active);
-- (no INSERT / UPDATE / DELETE grant or policy exists for anyone: writes go through admin_save_catalog_item,
--  which checks is_admin())
