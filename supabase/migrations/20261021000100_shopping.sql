-- =============================================================================
-- Boda Kilgoris — "Shopping list" orders, PART 2 of 2.
-- Run AFTER 20261021000000_shopping_status_values.sql (separate run). Idempotent; existing rides are
-- untouched (they become type = 'ride').
--
-- A shopping order IS a ride row (type = 'shopping'): same matching (a client picks an available Boda),
-- same request / accept / decline / expire / cancel / confirm / rating / counting machinery.
--   requested -> accepted -> shopping -> purchased -> delivering -> completed
--   (or declined / expired / cancelled)
-- No payment exists in the app: the Boda advances the money, the client repays on delivery, outside the app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- rides: type + shopping fields
-- -----------------------------------------------------------------------------
alter table public.rides add column if not exists type              text    not null default 'ride';
alter table public.rides add column if not exists budget_max_kes    integer;
alter table public.rides add column if not exists client_note       text;
alter table public.rides add column if not exists delivery_landmark text;
alter table public.rides add column if not exists items_count       integer not null default 0;
alter table public.rides add column if not exists items_total_kes   integer;
alter table public.rides add column if not exists delivery_fee_kes  integer;
alter table public.rides add column if not exists receipts_kept     boolean not null default false;
alter table public.rides add column if not exists receipts_shown    boolean not null default false;
alter table public.rides add column if not exists problem_reported  boolean not null default false;
alter table public.rides add column if not exists problem_type      text;
alter table public.rides add column if not exists problem_text      text;
alter table public.rides add column if not exists problem_at        timestamptz;
alter table public.rides add column if not exists shopping_at       timestamptz;
alter table public.rides add column if not exists purchased_at      timestamptz;
alter table public.rides add column if not exists delivering_at     timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rides_type_chk') then
    alter table public.rides add constraint rides_type_chk check (type in ('ride', 'shopping'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_shopping_fields_chk') then
    alter table public.rides add constraint rides_shopping_fields_chk check (
      (budget_max_kes   is null or budget_max_kes   between 0 and 1000000)
      and (items_total_kes  is null or items_total_kes  between 0 and 1000000)
      and (delivery_fee_kes is null or delivery_fee_kes between 0 and 100000)
      and (client_note       is null or char_length(client_note)       <= 500)
      and (delivery_landmark is null or char_length(delivery_landmark) <= 200)
      and (problem_text      is null or char_length(problem_text)      <= 500)
      and (problem_type      is null or problem_type in ('receipts_not_shown', 'total_mismatch', 'missing_item', 'other')));
  end if;
end $$;
create index if not exists rides_type_idx on public.rides (type, requested_at);

-- A running order = a ride or a shopping order that occupies the Boda.
create or replace function public.ride_is_running(p_status public.ride_status)
returns boolean language sql immutable as $$
  select p_status in ('accepted', 'arrived', 'shopping', 'purchased', 'delivering')
$$;

-- one live order per client, one running order per Boda (rides AND shopping share the rule)
drop index if exists public.rides_one_active_per_client;
create unique index rides_one_active_per_client
  on public.rides (client_id) where status in ('requested', 'accepted', 'arrived', 'shopping', 'purchased', 'delivering');
drop index if exists public.rides_one_running_per_boda;
create unique index rides_one_running_per_boda
  on public.rides (boda_id) where status in ('accepted', 'arrived', 'shopping', 'purchased', 'delivering');

insert into public.app_settings (key, value, description) values
  ('suspect_shopping_min_seconds', 300, 'Shopping order accepted_at -> completed_at shorter than this = suspect')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- catalog_items: the article catalogue (admin-maintained) + ride_items: the lines of an order
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_items (
  id         uuid primary key default gen_random_uuid(),
  name_en    text not null check (char_length(btrim(name_en)) between 1 and 80),
  name_sw    text not null check (char_length(btrim(name_sw)) between 1 and 80),
  category   text not null check (char_length(category) between 1 and 40),
  unit       text not null default 'piece' check (char_length(unit) between 1 and 20),
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists catalog_items_idx on public.catalog_items (active, category, sort_order);

create table if not exists public.ride_items (
  id               uuid primary key default gen_random_uuid(),
  ride_id          uuid not null references public.rides (id) on delete cascade,
  catalog_item_id  uuid references public.catalog_items (id) on delete set null,
  custom_name      text check (custom_name is null or char_length(btrim(custom_name)) between 1 and 120),
  -- names are copied at order time so the order stays readable if the catalogue changes later
  name_en          text,
  name_sw          text,
  quantity         integer not null default 1 check (quantity between 1 and 10000),
  unit             text,
  is_custom        boolean not null default false,
  status           text not null default 'pending' check (status in ('pending', 'bought', 'not_found', 'replaced')),
  replacement_text text check (replacement_text is null or char_length(replacement_text) <= 120),
  no_receipt       boolean not null default false,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  check ((is_custom and custom_name is not null) or (not is_custom and name_en is not null))
);
create index if not exists ride_items_ride_idx on public.ride_items (ride_id, position);

-- first catalogue (the admin edits it afterwards). Fixed ids + ON CONFLICT DO NOTHING: running this (or the
-- seed in 20261022000000_catalog_seed_and_public_read.sql) again never duplicates, never resurrects a hidden article.
insert into public.catalog_items (id, name_en, name_sw, category, unit, sort_order) values
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
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RLS: nobody writes directly (admin_save_catalog_item, request_shopping, shopping_set_item do)
-- -----------------------------------------------------------------------------
alter table public.catalog_items enable row level security;
alter table public.ride_items    enable row level security;
revoke all on public.catalog_items from anon, authenticated;
revoke all on public.ride_items    from anon, authenticated;
grant select on public.catalog_items to authenticated;
grant select on public.ride_items    to authenticated;

drop policy if exists catalog_read on public.catalog_items;
create policy catalog_read on public.catalog_items
  for select to authenticated using (active or public.is_admin());

-- The lines of an order are visible to the client who made it, to the Boda it was addressed to (from the moment
-- it is requested: that is what he must see to accept) and to the admin. Nobody else.
-- (the sub-select goes through rides_read, which is exactly that rule)
drop policy if exists ride_items_read on public.ride_items;
create policy ride_items_read on public.ride_items
  for select to authenticated using (
    exists (select 1 from public.rides r
             where r.id = ride_items.ride_id
               and (r.client_id = auth.uid() or r.boda_id = auth.uid() or public.is_admin())));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.ride_items; exception when duplicate_object then null; end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- State machine (rides_guard): rides keep their path, shopping gets its own
-- -----------------------------------------------------------------------------
create or replace function public.rides_guard()
returns trigger language plpgsql as $$
declare
  reasons    text[] := '{}';
  pair_count int;
  min_secs   numeric;
begin
  if tg_op = 'INSERT' then
    new.counted := false;
    new.counted_at := null;
    return new;
  end if;

  if new.client_id <> old.client_id or new.boda_id <> old.boda_id
     or new.pickup_lat <> old.pickup_lat or new.pickup_lng <> old.pickup_lng
     or new.requested_at <> old.requested_at
     or new.type <> old.type or new.items_count <> old.items_count then
    raise exception 'immutable_field';
  end if;

  if new.status <> old.status then
    if not (
         (old.status = 'requested'  and new.status in ('accepted', 'declined', 'expired', 'cancelled'))
      or (old.status = 'accepted'   and new.status in ('arrived', 'shopping', 'cancelled'))
      or (old.status = 'arrived'    and new.status in ('completed', 'cancelled'))
      or (old.status = 'shopping'   and new.status in ('purchased', 'cancelled'))
      or (old.status = 'purchased'  and new.status in ('delivering', 'cancelled'))
      or (old.status = 'delivering' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'invalid_transition';
    end if;
    -- each type walks its own path
    if (new.type = 'ride'     and new.status in ('shopping', 'purchased', 'delivering'))
       or (new.type = 'shopping' and new.status = 'arrived') then
      raise exception 'invalid_transition';
    end if;

    if new.status = 'accepted'   then new.accepted_at   := coalesce(new.accepted_at, now()); end if;
    if new.status = 'arrived'    then new.arrived_at    := coalesce(new.arrived_at, now()); end if;
    if new.status = 'shopping'   then new.shopping_at   := coalesce(new.shopping_at, now()); end if;
    if new.status = 'purchased'  then new.purchased_at  := coalesce(new.purchased_at, now()); end if;
    if new.status = 'delivering' then new.delivering_at := coalesce(new.delivering_at, now()); end if;
    if new.status = 'declined'   then new.declined_at   := coalesce(new.declined_at, now()); end if;
    if new.status = 'expired'    then new.expired_at    := coalesce(new.expired_at, now()); end if;
    if new.status = 'cancelled'  then new.cancelled_at  := coalesce(new.cancelled_at, now()); end if;

    -- the data each shopping step must carry (the app asks for it; the database insists)
    if new.status = 'purchased' then
      if new.items_total_kes is null then raise exception 'invalid_amount'; end if;
      if not new.receipts_kept then raise exception 'receipts_required'; end if;
    end if;
    if new.type = 'shopping' and new.status = 'completed' then
      if new.delivery_fee_kes is null then raise exception 'invalid_amount'; end if;
      if not new.receipts_shown then raise exception 'receipts_required'; end if;
    end if;

    if new.status = 'completed' then
      new.completed_at   := coalesce(new.completed_at, now());
      new.boda_confirmed := true;            -- "Ride completed" / "Delivered" = the Boda's confirmation

      min_secs := case when new.type = 'shopping'
                       then public.setting_num('suspect_shopping_min_seconds', 300)
                       else public.setting_num('suspect_min_seconds', 120) end;
      if new.completed_at - new.accepted_at < make_interval(secs => min_secs) then
        reasons := array_append(reasons, 'too_fast');
      end if;

      select count(*) into pair_count
      from public.rides r
      where r.client_id = new.client_id and r.boda_id = new.boda_id
        and r.status = 'completed' and r.id <> new.id
        and public.nairobi_day(r.completed_at) = public.nairobi_day(new.completed_at);
      if pair_count + 1 > public.setting_num('suspect_pair_per_day', 10) then
        reasons := array_append(reasons, 'pair_frequency');
      end if;

      new.suspect_reason := reasons;
      new.suspect := cardinality(reasons) > 0;
    end if;

    -- the client's number is shared with the Boda for the duration of a shopping order only
    if new.type = 'shopping' and new.status in ('completed', 'cancelled', 'declined', 'expired') then
      new.client_phone := null;
    end if;
  end if;

  -- confirmation + rating only exist on a completed ride, and can never be undone
  if (new.client_confirmed is distinct from old.client_confirmed
      or new.rating is distinct from old.rating) then
    if old.status <> 'completed' or new.status <> 'completed'
       or (old.client_confirmed and not new.client_confirmed) then
      raise exception 'invalid_state';
    end if;
  end if;
  -- the agreed price is written by the UPDATE that completes the ride
  if new.agreed_price_kes is distinct from old.agreed_price_kes
     and not (old.status = 'arrived' and new.status = 'completed') then
    raise exception 'invalid_state';
  end if;
  -- shopping amounts / receipt flags are written by the step that owns them, never later
  if (new.items_total_kes is distinct from old.items_total_kes or new.receipts_kept is distinct from old.receipts_kept)
     and not (old.status = 'shopping' and new.status = 'purchased') then
    raise exception 'invalid_state';
  end if;
  if (new.delivery_fee_kes is distinct from old.delivery_fee_kes or new.receipts_shown is distinct from old.receipts_shown)
     and not (old.status = 'delivering' and new.status = 'completed') then
    raise exception 'invalid_state';
  end if;
  if (new.problem_reported is distinct from old.problem_reported or new.problem_type is distinct from old.problem_type
      or new.problem_text is distinct from old.problem_text)
     and not (old.status = 'completed' and new.status = 'completed') then
    raise exception 'invalid_state';
  end if;

  new.counted := new.status = 'completed' and new.boda_confirmed and new.client_confirmed;
  if new.counted and not old.counted then
    new.counted_at := now();
  elsif not new.counted then
    new.counted_at := old.counted_at;
  end if;

  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Visibility of a running order's Boda to its client (rides + shopping)
-- -----------------------------------------------------------------------------
create or replace function public.client_follows_boda(p_boda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rides r
    where r.boda_id = p_boda and r.client_id = auth.uid()
      and public.ride_is_running(r.status)
  )
$$;

-- -----------------------------------------------------------------------------
-- Boda availability / location: "in a running order" now includes the shopping statuses
-- -----------------------------------------------------------------------------
create or replace function public.set_availability(
  p_available boolean,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy real default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bp  public.boda_profiles;
begin
  select * into v_bp from public.boda_profiles where user_id = v_uid;
  if not found then raise exception 'not_a_boda'; end if;
  if v_bp.status <> 'approved' then raise exception 'boda_not_approved'; end if;

  if p_available then
    if exists (select 1 from public.rides where boda_id = v_uid and public.ride_is_running(status)) then
      raise exception 'ride_in_progress';
    end if;
    if p_lat is null or p_lng is null then raise exception 'invalid_location'; end if;
    update public.boda_profiles
       set is_available = true, available_since = now()
     where user_id = v_uid;
    insert into public.boda_locations (boda_id, lat, lng, accuracy_m, updated_at)
    values (v_uid, p_lat, p_lng, p_accuracy, now())
    on conflict (boda_id) do update
      set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
    perform public.touch_boda_activity(v_uid);
  else
    update public.boda_profiles set is_available = false, available_since = null where user_id = v_uid;
    -- position is only kept while available or in a running order
    if not exists (select 1 from public.rides where boda_id = v_uid and public.ride_is_running(status)) then
      delete from public.boda_locations where boda_id = v_uid;
    end if;
  end if;
end $$;

create or replace function public.update_location(
  p_lat double precision, p_lng double precision, p_accuracy real default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bp  public.boda_profiles;
begin
  select * into v_bp from public.boda_profiles where user_id = v_uid;
  if not found then raise exception 'not_a_boda'; end if;
  if v_bp.status <> 'approved' then raise exception 'boda_not_approved'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  if not v_bp.is_available
     and not exists (select 1 from public.rides where boda_id = v_uid and public.ride_is_running(status)) then
    raise exception 'not_available';
  end if;
  insert into public.boda_locations (boda_id, lat, lng, accuracy_m, updated_at)
  values (v_uid, p_lat, p_lng, p_accuracy, now())
  on conflict (boda_id) do update
    set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  perform public.touch_boda_activity(v_uid);
end $$;

-- -----------------------------------------------------------------------------
-- Matching: ONE place decides whether a Boda can be requested (rides and shopping both call it)
-- -----------------------------------------------------------------------------
create or replace function public.boda_for_request(p_boda_id uuid)
returns table (name text, plate text, photo_url text)
language plpgsql security definer set search_path = public as $$
declare v_boda record;
begin
  select p.name, bp.plate, bp.photo_url, bp.status, bp.is_available, l.updated_at as loc_at
    into v_boda
    from public.boda_profiles bp
    join public.profiles p on p.id = bp.user_id
    left join public.boda_locations l on l.boda_id = bp.user_id
   where bp.user_id = p_boda_id;

  if not found or v_boda.status <> 'approved' or not v_boda.is_available
     or v_boda.loc_at is null
     or v_boda.loc_at < now() - make_interval(secs => public.setting_num('location_fresh_seconds', 180)) then
    raise exception 'boda_unavailable';
  end if;
  return query select v_boda.name, v_boda.plate, v_boda.photo_url;
end $$;
revoke all on function public.boda_for_request(uuid) from public, anon, authenticated;

-- request_ride: same behaviour as before, now through the shared Boda check
create or replace function public.request_ride(
  p_boda_id uuid, p_lat double precision, p_lng double precision, p_destination text default null,
  p_dest_lat double precision default null, p_dest_lng double precision default null,
  p_pickup_note text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_client public.profiles;
  v_boda   record;
  v_ride   public.rides;
  v_dlat   double precision := p_dest_lat;
  v_dlng   double precision := p_dest_lng;
begin
  select * into v_client from public.profiles where id = v_uid;
  if not found or v_client.role <> 'client' then raise exception 'not_a_client'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;

  if v_dlat is null or v_dlng is null or v_dlat not between -90 and 90 or v_dlng not between -180 and 180 then
    v_dlat := null;
    v_dlng := null;
  end if;

  -- free the slot if a previous request silently timed out
  update public.rides set status = 'expired'
   where client_id = v_uid and status = 'requested' and expires_at <= now();

  select * into v_boda from public.boda_for_request(p_boda_id);

  begin
    insert into public.rides (
      client_id, boda_id, pickup_lat, pickup_lng, pickup_note,
      destination_text, destination_lat, destination_lng, expires_at,
      client_name, boda_name, boda_plate, boda_photo_url)
    values (
      v_uid, p_boda_id, p_lat, p_lng, left(nullif(btrim(p_pickup_note), ''), 200),
      left(nullif(btrim(p_destination), ''), 200), v_dlat, v_dlng,
      now() + make_interval(secs => public.setting_num('request_timeout_seconds', 120)),
      v_client.name, v_boda.name, v_boda.plate, v_boda.photo_url)
    returning * into v_ride;
  exception when unique_violation then
    raise exception 'client_has_active_ride';
  end;
  return v_ride;
end $$;

-- -----------------------------------------------------------------------------
-- request_shopping: a shopping order = a ride row (type 'shopping') + its lines.
--   p_lat/p_lng = delivery location (mandatory, like a pick-up). No destination pin is ever required.
--   p_items = [{"catalog_item_id": uuid, "quantity": n} | {"custom_name": "2 packets of Krackers", "quantity": n}, ...]
-- -----------------------------------------------------------------------------
create or replace function public.request_shopping(
  p_boda_id uuid, p_lat double precision, p_lng double precision, p_items jsonb,
  p_budget integer default null, p_note text default null, p_landmark text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_client public.profiles;
  v_boda   record;
  v_ride   public.rides;
  v_budget integer := p_budget;
  v_item   jsonb;
  v_pos    integer := 0;
  v_cat    public.catalog_items;
  v_name   text;
  v_qty    integer;
begin
  select * into v_client from public.profiles where id = v_uid;
  if not found or v_client.role <> 'client' then raise exception 'not_a_client'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_list';
  end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'too_many_items'; end if;
  if v_budget is not null and v_budget not between 0 and 1000000 then v_budget := null; end if;  -- never blocking

  update public.rides set status = 'expired'
   where client_id = v_uid and status = 'requested' and expires_at <= now();

  select * into v_boda from public.boda_for_request(p_boda_id);

  begin
    insert into public.rides (
      type, client_id, boda_id, pickup_lat, pickup_lng, delivery_landmark, budget_max_kes, client_note,
      items_count, expires_at, client_name, boda_name, boda_plate, boda_photo_url)
    values (
      'shopping', v_uid, p_boda_id, p_lat, p_lng, left(nullif(btrim(p_landmark), ''), 200), v_budget,
      left(nullif(btrim(p_note), ''), 500), jsonb_array_length(p_items),
      now() + make_interval(secs => public.setting_num('request_timeout_seconds', 120)),
      v_client.name, v_boda.name, v_boda.plate, v_boda.photo_url)
    returning * into v_ride;
  exception when unique_violation then
    raise exception 'client_has_active_ride';
  end;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    v_qty := greatest(1, least(10000, coalesce(nullif(v_item->>'quantity', '')::integer, 1)));
    if nullif(v_item->>'catalog_item_id', '') is not null then
      select * into v_cat from public.catalog_items where id = (v_item->>'catalog_item_id')::uuid and active;
      if not found then raise exception 'invalid_item'; end if;
      insert into public.ride_items (ride_id, catalog_item_id, name_en, name_sw, quantity, unit, is_custom, position)
      values (v_ride.id, v_cat.id, v_cat.name_en, v_cat.name_sw, v_qty, v_cat.unit, false, v_pos);
    else
      v_name := left(btrim(coalesce(v_item->>'custom_name', '')), 120);
      if v_name = '' then raise exception 'invalid_item'; end if;
      insert into public.ride_items (ride_id, custom_name, quantity, is_custom, position)
      values (v_ride.id, v_name, v_qty, true, v_pos);
    end if;
  end loop;
  return v_ride;
end $$;

-- -----------------------------------------------------------------------------
-- The Boda's steps (accept / decline / cancel / confirm are the shared ride functions)
-- -----------------------------------------------------------------------------
create or replace function public.shopping_start(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() and type = 'shopping' for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'accepted' then raise exception 'invalid_state'; end if;
  update public.rides set status = 'shopping' where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

create or replace function public.shopping_purchased(
  p_ride_id uuid, p_items_total_kes integer, p_receipts_kept boolean)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() and type = 'shopping' for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'shopping' then raise exception 'invalid_state'; end if;
  if p_items_total_kes is null or p_items_total_kes not between 0 and 1000000 then raise exception 'invalid_amount'; end if;
  if p_receipts_kept is not true then raise exception 'receipts_required'; end if;
  update public.rides set status = 'purchased', items_total_kes = p_items_total_kes, receipts_kept = true
   where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

create or replace function public.shopping_deliver_start(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() and type = 'shopping' for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'purchased' then raise exception 'invalid_state'; end if;
  update public.rides set status = 'delivering' where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

create or replace function public.shopping_complete(
  p_ride_id uuid, p_delivery_fee_kes integer, p_receipts_shown boolean)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() and type = 'shopping' for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'delivering' then raise exception 'invalid_state'; end if;
  if p_delivery_fee_kes is null or p_delivery_fee_kes not between 0 and 100000 then raise exception 'invalid_amount'; end if;
  if p_receipts_shown is not true then raise exception 'receipts_required'; end if;
  update public.rides set status = 'completed', delivery_fee_kes = p_delivery_fee_kes, receipts_shown = true
   where id = p_ride_id returning * into v_ride;
  -- the order is over: stop exposing the Boda's position (he stays unavailable until he toggles)
  delete from public.boda_locations l
   where l.boda_id = v_ride.boda_id
     and not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available);
  return v_ride;
end $$;

-- "bought" / "not found" (+ optional replacement => 'replaced') / back to "pending"; "no receipt" never blocks anything.
create or replace function public.shopping_set_item(
  p_item_id uuid, p_status text default null, p_replacement text default null, p_no_receipt boolean default null)
returns public.ride_items language plpgsql security definer set search_path = public as $$
declare
  v_item   public.ride_items;
  v_ride   public.rides;
  v_status text := p_status;
  v_repl   text := nullif(btrim(coalesce(p_replacement, '')), '');
begin
  select * into v_item from public.ride_items where id = p_item_id for update;
  if not found then raise exception 'item_not_found'; end if;
  select * into v_ride from public.rides where id = v_item.ride_id and boda_id = auth.uid() and type = 'shopping';
  if not found then raise exception 'item_not_found'; end if;
  if v_ride.status not in ('shopping', 'purchased') then raise exception 'invalid_state'; end if;
  if v_status is not null and v_status not in ('pending', 'bought', 'not_found', 'replaced') then
    raise exception 'invalid_item';
  end if;
  if v_status = 'replaced' and v_repl is null then v_status := 'not_found'; end if;
  update public.ride_items
     set status = coalesce(v_status, status),
         replacement_text = case when coalesce(v_status, status) = 'replaced' then left(coalesce(v_repl, replacement_text), 120) else null end,
         no_receipt = coalesce(p_no_receipt, no_receipt)
   where id = p_item_id returning * into v_item;
  return v_item;
end $$;

-- The client reports a problem with a delivered order (admin sees it). One report per order.
create or replace function public.report_ride_problem(p_ride_id uuid, p_type text, p_text text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and client_id = auth.uid() and type = 'shopping' for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'completed' then raise exception 'invalid_state'; end if;
  if p_type is null or p_type not in ('receipts_not_shown', 'total_mismatch', 'missing_item', 'other') then
    raise exception 'invalid_problem';
  end if;
  if v_ride.problem_reported then raise exception 'already_reported'; end if;
  update public.rides
     set problem_reported = true, problem_type = p_type, problem_at = now(),
         problem_text = left(nullif(btrim(coalesce(p_text, '')), ''), 500),
         suspect = true,
         suspect_reason = case when 'problem_reported' = any (suspect_reason) then suspect_reason
                               else array_append(suspect_reason, 'problem_reported') end
   where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

-- cancel: any running state of either type
create or replace function public.cancel_ride(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_ride public.rides;
  v_by   text;
begin
  select * into v_ride from public.rides
   where id = p_ride_id and (client_id = v_uid or boda_id = v_uid) for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'requested' and not public.ride_is_running(v_ride.status) then raise exception 'invalid_state'; end if;
  v_by := case when v_ride.client_id = v_uid then 'client' else 'boda' end;
  update public.rides set status = 'cancelled', cancelled_by = v_by
   where id = p_ride_id returning * into v_ride;
  delete from public.boda_locations l
   where l.boda_id = v_ride.boda_id
     and not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available);
  return v_ride;
end $$;

-- housekeeping: running = rides AND shopping
create or replace function public.run_sweep()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.rides set status = 'expired'
   where status = 'requested' and expires_at <= now();

  update public.rides
     set client_confirmed = true, auto_confirmed = true
   where status = 'completed' and boda_confirmed and not client_confirmed
     and completed_at <= now() - make_interval(mins => public.setting_num('auto_confirm_minutes', 30)::int);

  update public.rides set status = 'cancelled', cancelled_by = 'system'
   where public.ride_is_running(status)
     and accepted_at <= now() - make_interval(hours => public.setting_num('max_active_ride_hours', 6)::int);

  update public.boda_profiles bp
     set is_available = false, available_since = null
   where bp.is_available
     and coalesce((select l.updated_at from public.boda_locations l where l.boda_id = bp.user_id),
                  bp.available_since)
         < now() - make_interval(mins => public.setting_num('stale_available_minutes', 15)::int);

  delete from public.boda_locations l
   where not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available)
     and not exists (select 1 from public.rides r where r.boda_id = l.boda_id and public.ride_is_running(r.status));
end $$;

-- -----------------------------------------------------------------------------
-- Admin: catalogue
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_catalog_item(
  p_id uuid, p_name_en text, p_name_sw text, p_category text, p_unit text,
  p_active boolean default true, p_sort_order integer default null)
returns public.catalog_items language plpgsql security definer set search_path = public as $$
declare v_item public.catalog_items;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  p_name_en  := btrim(coalesce(p_name_en, ''));
  p_name_sw  := btrim(coalesce(p_name_sw, ''));
  p_category := btrim(coalesce(p_category, ''));
  p_unit     := btrim(coalesce(p_unit, ''));
  if char_length(p_name_en) not between 1 and 80 or char_length(p_name_sw) not between 1 and 80
     or char_length(p_category) not between 1 and 40 or char_length(p_unit) not between 1 and 20 then
    raise exception 'invalid_item';
  end if;
  if p_id is null then
    insert into public.catalog_items (name_en, name_sw, category, unit, active, sort_order)
    values (p_name_en, p_name_sw, p_category, p_unit, coalesce(p_active, true),
            coalesce(p_sort_order, (select coalesce(max(sort_order), 0) + 10 from public.catalog_items)))
    returning * into v_item;
  else
    update public.catalog_items
       set name_en = p_name_en, name_sw = p_name_sw, category = p_category, unit = p_unit,
           active = coalesce(p_active, true), sort_order = coalesce(p_sort_order, sort_order)
     where id = p_id returning * into v_item;
    if not found then raise exception 'not_found'; end if;
  end if;
  return v_item;
end $$;

create or replace function public.admin_swap_catalog_order(p_a uuid, p_b uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a integer; v_b integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select sort_order into v_a from public.catalog_items where id = p_a;
  select sort_order into v_b from public.catalog_items where id = p_b;
  if v_a is null or v_b is null then raise exception 'not_found'; end if;
  if v_a = v_b then v_b := v_b + 1; end if;      -- ties: still make them different
  update public.catalog_items set sort_order = v_b where id = p_a;
  update public.catalog_items set sort_order = v_a where id = p_b;
end $$;

-- -----------------------------------------------------------------------------
-- Admin: counters. The existing overview / series / per-Boda stats now describe RIDES only,
-- shopping has its own numbers (admin_shopping_overview).
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today timestamptz := date_trunc('day',   now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_week  timestamptz := date_trunc('week',  now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_month timestamptz := date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_30    timestamptz := now() - interval '30 days';
  v_rides jsonb;
  v_act   jsonb;
  v_bodas jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'counted', jsonb_build_object(
      'today', count(*) filter (where counted and completed_at >= v_today),
      'week',  count(*) filter (where counted and completed_at >= v_week),
      'month', count(*) filter (where counted and completed_at >= v_month),
      'total', count(*) filter (where counted)),
    'counted_clean', jsonb_build_object(
      'today', count(*) filter (where counted and not suspect and completed_at >= v_today),
      'week',  count(*) filter (where counted and not suspect and completed_at >= v_week),
      'month', count(*) filter (where counted and not suspect and completed_at >= v_month),
      'total', count(*) filter (where counted and not suspect)),
    'completed', jsonb_build_object(
      'today', count(*) filter (where status = 'completed' and completed_at >= v_today),
      'week',  count(*) filter (where status = 'completed' and completed_at >= v_week),
      'month', count(*) filter (where status = 'completed' and completed_at >= v_month)),
    'suspect', jsonb_build_object(
      'today', count(*) filter (where suspect and completed_at >= v_today),
      'week',  count(*) filter (where suspect and completed_at >= v_week),
      'month', count(*) filter (where suspect and completed_at >= v_month),
      'total', count(*) filter (where suspect)),
    'requests', jsonb_build_object(
      'today', count(*) filter (where requested_at >= v_today),
      'week',  count(*) filter (where requested_at >= v_week),
      'month', count(*) filter (where requested_at >= v_month)),
    'awaiting_confirmation', count(*) filter (where status = 'completed' and not client_confirmed),
    'auto_confirmed_month',  count(*) filter (where auto_confirmed and completed_at >= v_month),
    'acceptance_30d', jsonb_build_object(
      'accepted',  count(*) filter (where requested_at >= v_30 and accepted_at is not null),
      'responded', count(*) filter (where requested_at >= v_30
                                    and (accepted_at is not null or status in ('declined', 'expired'))),
      'avg_accept_seconds', (round(avg(extract(epoch from accepted_at - requested_at))
                              filter (where requested_at >= v_30 and accepted_at is not null)))::int)
  ) into v_rides from public.rides where type = 'ride';

  select jsonb_build_object('active_bodas', jsonb_build_object(
    'today', count(distinct boda_id) filter (where day >= public.nairobi_day(v_today)),
    'week',  count(distinct boda_id) filter (where day >= public.nairobi_day(v_week)),
    'month', count(distinct boda_id) filter (where day >= public.nairobi_day(v_month))))
    into v_act from public.boda_daily_activity;

  select jsonb_build_object('bodas', jsonb_build_object(
    'pending',   count(*) filter (where status = 'pending'),
    'approved',  count(*) filter (where status = 'approved'),
    'suspended', count(*) filter (where status = 'suspended'),
    'available_now', count(*) filter (where is_available)))
    into v_bodas from public.boda_profiles;

  return v_rides || v_act || v_bodas;
end $$;

drop function if exists public.admin_daily_series(int);
create or replace function public.admin_daily_series(p_days int default 30, p_type text default 'ride')
returns table (
  day date, requests int, accepted int, completed int,
  counted int, counted_clean int, suspect int, active_bodas int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  with days as (
    select d::date as day
    from generate_series(public.nairobi_day(now()) - (greatest(p_days, 1) - 1),
                         public.nairobi_day(now()), interval '1 day') d
  ),
  req as (
    select public.nairobi_day(requested_at) as day,
           count(*) as requests,
           count(*) filter (where accepted_at is not null) as accepted
    from public.rides where type = p_type group by 1
  ),
  done as (
    select public.nairobi_day(completed_at) as day,
           count(*) as completed,
           count(*) filter (where counted) as counted,
           count(*) filter (where counted and not suspect) as counted_clean,
           count(*) filter (where suspect) as suspect
    from public.rides where completed_at is not null and type = p_type group by 1
  ),
  act as (
    select a.day, count(*) as active_bodas from public.boda_daily_activity a group by 1
  )
  select d.day,
         coalesce(req.requests, 0)::int, coalesce(req.accepted, 0)::int,
         coalesce(done.completed, 0)::int, coalesce(done.counted, 0)::int,
         coalesce(done.counted_clean, 0)::int, coalesce(done.suspect, 0)::int,
         coalesce(act.active_bodas, 0)::int
  from days d
  left join req  on req.day  = d.day
  left join done on done.day = d.day
  left join act  on act.day  = d.day
  order by d.day;
end $$;

drop function if exists public.admin_boda_stats();
create or replace function public.admin_boda_stats()
returns table (
  id uuid, name text, phone text, plate text, photo_url text,
  status public.boda_status, is_available boolean,
  rating_avg numeric, rating_count int, created_at timestamptz,
  requests int, responded int, accepted int, counted int, suspect int,
  avg_accept_seconds int, last_online_at timestamptz,
  shopping_orders int, shopping_counted int, shopping_suspect int,
  receipts_kept_pct int, receipts_shown_pct int, no_receipt_pct int,
  avg_order_kes int, avg_delivery_fee_kes int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select bp.user_id, p.name, p.phone, bp.plate, bp.photo_url,
         bp.status, bp.is_available, bp.rating_avg, bp.rating_count, bp.created_at,
         coalesce(s.requests, 0)::int, coalesce(s.responded, 0)::int, coalesce(s.accepted, 0)::int,
         coalesce(s.counted, 0)::int, coalesce(s.suspect, 0)::int,
         s.avg_accept_seconds::int,
         (select max(a.last_online_at) from public.boda_daily_activity a where a.boda_id = bp.user_id),
         coalesce(o.orders, 0)::int, coalesce(o.counted, 0)::int, coalesce(o.suspect, 0)::int,
         o.kept_pct::int, o.shown_pct::int, n.no_receipt_pct::int,
         o.avg_order::int, o.avg_fee::int
  from public.boda_profiles bp
  join public.profiles p on p.id = bp.user_id
  left join (
    select r.boda_id,
           count(*) as requests,
           count(*) filter (where r.accepted_at is not null or r.status in ('declined', 'expired')) as responded,
           count(*) filter (where r.accepted_at is not null) as accepted,
           count(*) filter (where r.counted) as counted,
           count(*) filter (where r.suspect) as suspect,
           round(avg(extract(epoch from r.accepted_at - r.requested_at))
                 filter (where r.accepted_at is not null)) as avg_accept_seconds
    from public.rides r where r.type = 'ride' group by r.boda_id
  ) s on s.boda_id = bp.user_id
  left join (
    select r.boda_id,
           count(*) filter (where r.accepted_at is not null) as orders,
           count(*) filter (where r.counted) as counted,
           count(*) filter (where r.suspect) as suspect,
           round(100.0 * count(*) filter (where r.receipts_kept)
                 / nullif(count(*) filter (where r.purchased_at is not null), 0)) as kept_pct,
           round(100.0 * count(*) filter (where r.receipts_shown)
                 / nullif(count(*) filter (where r.status = 'completed'), 0)) as shown_pct,
           round(avg(r.items_total_kes) filter (where r.items_total_kes is not null)) as avg_order,
           round(avg(r.delivery_fee_kes) filter (where r.delivery_fee_kes is not null)) as avg_fee
    from public.rides r where r.type = 'shopping' group by r.boda_id
  ) o on o.boda_id = bp.user_id
  left join (
    select r.boda_id,
           round(100.0 * count(*) filter (where i.no_receipt and i.status in ('bought', 'replaced'))
                 / nullif(count(*) filter (where i.status in ('bought', 'replaced')), 0)) as no_receipt_pct
    from public.ride_items i join public.rides r on r.id = i.ride_id group by r.boda_id
  ) n on n.boda_id = bp.user_id
  order by (bp.status = 'pending') desc, p.name;
end $$;

create or replace function public.admin_shopping_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today timestamptz := date_trunc('day',   now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_week  timestamptz := date_trunc('week',  now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_month timestamptz := date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  v_orders jsonb;
  v_types  jsonb;
  v_items  jsonb;
  v_custom jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'requests', jsonb_build_object(
      'today', count(*) filter (where requested_at >= v_today),
      'week',  count(*) filter (where requested_at >= v_week),
      'month', count(*) filter (where requested_at >= v_month),
      'total', count(*)),
    'counted', jsonb_build_object(
      'today', count(*) filter (where counted and completed_at >= v_today),
      'week',  count(*) filter (where counted and completed_at >= v_week),
      'month', count(*) filter (where counted and completed_at >= v_month),
      'total', count(*) filter (where counted)),
    'completed', jsonb_build_object(
      'today', count(*) filter (where status = 'completed' and completed_at >= v_today),
      'week',  count(*) filter (where status = 'completed' and completed_at >= v_week),
      'month', count(*) filter (where status = 'completed' and completed_at >= v_month),
      'total', count(*) filter (where status = 'completed')),
    'suspect', jsonb_build_object(
      'week',  count(*) filter (where suspect and completed_at >= v_week),
      'month', count(*) filter (where suspect and completed_at >= v_month),
      'total', count(*) filter (where suspect)),
    'awaiting_confirmation', count(*) filter (where status = 'completed' and not client_confirmed),
    'avg_order_kes',        round(avg(items_total_kes) filter (where status = 'completed')),
    'avg_delivery_fee_kes', round(avg(delivery_fee_kes) filter (where status = 'completed')),
    'problems', jsonb_build_object(
      'reported', count(*) filter (where problem_reported),
      'completed', count(*) filter (where status = 'completed'),
      'rate_pct', round(100.0 * count(*) filter (where problem_reported)
                        / nullif(count(*) filter (where status = 'completed'), 0))),
    'receipts', jsonb_build_object(
      'kept_pct',  round(100.0 * count(*) filter (where receipts_kept)
                         / nullif(count(*) filter (where purchased_at is not null), 0)),
      'shown_pct', round(100.0 * count(*) filter (where receipts_shown)
                         / nullif(count(*) filter (where status = 'completed'), 0)))
  ) into v_orders from public.rides where type = 'shopping';

  select coalesce(jsonb_object_agg(problem_type, n), '{}'::jsonb) into v_types
  from (select problem_type, count(*) n from public.rides
         where type = 'shopping' and problem_reported group by problem_type) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_items
  from (select name_en, name_sw, count(distinct ride_id) as orders, sum(quantity) as quantity, min(unit) as unit
          from public.ride_items where not is_custom
         group by name_en, name_sw order by count(distinct ride_id) desc, name_en limit 10) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_custom
  from (select min(btrim(custom_name)) as name, count(*) as n
          from public.ride_items where is_custom
         group by lower(btrim(custom_name)) order by count(*) desc, min(btrim(custom_name)) limit 15) t;

  return v_orders || jsonb_build_object(
    'no_receipt_items_pct',
      (select round(100.0 * count(*) filter (where no_receipt and status in ('bought', 'replaced'))
                    / nullif(count(*) filter (where status in ('bought', 'replaced')), 0)) from public.ride_items),
    'problem_types', v_types, 'top_items', v_items, 'top_custom', v_custom);
end $$;

create or replace function public.admin_shopping_problems(p_limit int default 200)
returns table (
  id uuid, requested_at timestamptz, completed_at timestamptz, problem_at timestamptz,
  problem_type text, problem_text text, client_name text, client_phone text, boda_name text, boda_plate text,
  budget_max_kes int, items_total_kes int, delivery_fee_kes int, receipts_kept boolean, receipts_shown boolean,
  client_confirmed boolean, client_note text, delivery_landmark text, items jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select r.id, r.requested_at, r.completed_at, r.problem_at, r.problem_type, r.problem_text,
         r.client_name, (select p.phone from public.profiles p where p.id = r.client_id), r.boda_name, r.boda_plate,
         r.budget_max_kes, r.items_total_kes, r.delivery_fee_kes, r.receipts_kept, r.receipts_shown,
         r.client_confirmed, r.client_note, r.delivery_landmark,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'name_en', i.name_en, 'name_sw', i.name_sw, 'custom_name', i.custom_name, 'quantity', i.quantity,
                     'unit', i.unit, 'status', i.status, 'replacement_text', i.replacement_text,
                     'no_receipt', i.no_receipt) order by i.position)
                     from public.ride_items i where i.ride_id = r.id), '[]'::jsonb)
  from public.rides r
  where r.type = 'shopping' and r.problem_reported
  order by r.problem_at desc
  limit greatest(1, least(p_limit, 500));
end $$;

-- -----------------------------------------------------------------------------
-- Function privileges (the default would hand EXECUTE to anon + authenticated)
-- -----------------------------------------------------------------------------
revoke all on function
  public.ride_is_running(public.ride_status),
  public.request_shopping(uuid, double precision, double precision, jsonb, integer, text, text),
  public.shopping_start(uuid), public.shopping_purchased(uuid, integer, boolean),
  public.shopping_deliver_start(uuid), public.shopping_complete(uuid, integer, boolean),
  public.shopping_set_item(uuid, text, text, boolean), public.report_ride_problem(uuid, text, text),
  public.admin_save_catalog_item(uuid, text, text, text, text, boolean, integer),
  public.admin_swap_catalog_order(uuid, uuid),
  public.admin_daily_series(int, text), public.admin_boda_stats(),
  public.admin_shopping_overview(), public.admin_shopping_problems(int)
from public, anon, authenticated;
grant execute on function
  public.ride_is_running(public.ride_status),
  public.request_shopping(uuid, double precision, double precision, jsonb, integer, text, text),
  public.shopping_start(uuid), public.shopping_purchased(uuid, integer, boolean),
  public.shopping_deliver_start(uuid), public.shopping_complete(uuid, integer, boolean),
  public.shopping_set_item(uuid, text, text, boolean), public.report_ride_problem(uuid, text, text),
  public.admin_save_catalog_item(uuid, text, text, text, text, boolean, integer),
  public.admin_swap_catalog_order(uuid, uuid),
  public.admin_daily_series(int, text), public.admin_boda_stats(),
  public.admin_shopping_overview(), public.admin_shopping_problems(int)
to authenticated;
