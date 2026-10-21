-- =============================================================================
-- Boda Kilgoris — PRODUCTION UPDATE, SCRIPT 1 OF 2
-- Paste the WHOLE file in the Supabase SQL Editor and run it. Then run script 2 as a SEPARATE run.
-- (= migrations 20261020000000 + 20261021000000; idempotent; existing rides are untouched)
-- =============================================================================

-- =============================================================================
-- Boda Kilgoris — destination becomes optional, frequent places, pick-up landmark
-- Run AFTER 20261016000000_init.sql. Safe to re-run (idempotent) and it never touches existing rides.
--
--  * rides.destination_text was already nullable; destination_lat / destination_lng are NEW columns,
--    nullable. Existing rows simply get NULL there.
--  * rides.pickup_note: optional landmark for the pick-up point ("in front of the blue shop").
--  * places: frequent destinations the admin maintains (EMPTY at start — nothing is invented).
--  * request_ride(): destination is never validated in a blocking way; the pick-up still is.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- rides: optional destination coordinates + optional pick-up landmark
-- -----------------------------------------------------------------------------
alter table public.rides alter column destination_text drop not null;   -- no-op if already nullable

alter table public.rides add column if not exists destination_lat double precision;
alter table public.rides add column if not exists destination_lng double precision;
alter table public.rides add column if not exists pickup_note     text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rides_destination_coords_chk') then
    alter table public.rides add constraint rides_destination_coords_chk check (
      (destination_lat is null and destination_lng is null)
      or (destination_lat between -90 and 90 and destination_lng between -180 and 180));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rides_pickup_note_len_chk') then
    alter table public.rides add constraint rides_pickup_note_len_chk check (
      pickup_note is null or char_length(pickup_note) <= 200);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- places: frequent destinations (shortcuts under the destination field)
-- -----------------------------------------------------------------------------
create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists places_active_idx on public.places (active, name);

alter table public.places enable row level security;

-- Same rule as every other table: nobody writes directly (writes go through admin_save_place).
-- New tables inherit Supabase's default grants, so take them away explicitly.
revoke all on public.places from anon, authenticated;
grant select on public.places to authenticated;

drop policy if exists places_read on public.places;
create policy places_read on public.places
  for select to authenticated using (active or public.is_admin());

-- Add or edit a place (p_id null = add). "Delete" is deactivation: p_active = false.
create or replace function public.admin_save_place(
  p_id uuid, p_name text, p_lat double precision, p_lng double precision, p_active boolean default true)
returns public.places language plpgsql security definer set search_path = public as $$
declare v_place public.places;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 80
     or p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_place';
  end if;

  if p_id is null then
    insert into public.places (name, lat, lng, active)
    values (p_name, p_lat, p_lng, coalesce(p_active, true))
    returning * into v_place;
  else
    update public.places
       set name = p_name, lat = p_lat, lng = p_lng, active = coalesce(p_active, true)
     where id = p_id
     returning * into v_place;
    if not found then raise exception 'not_found'; end if;
  end if;
  return v_place;
end $$;

revoke all on function public.admin_save_place(uuid, text, double precision, double precision, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_save_place(uuid, text, double precision, double precision, boolean)
  to authenticated;

-- -----------------------------------------------------------------------------
-- request_ride: destination fields and landmark are optional and never block the request.
--   * p_dest_lat/p_dest_lng: kept only when BOTH are valid; anything else is stored as NULL
--   * p_destination / p_pickup_note: trimmed, empty -> NULL, cut at 200 characters
-- The pick-up point stays mandatory (the Boda must find the client).
-- The old 4-argument signature is dropped: with defaults on the new one, keeping both would make
-- calls ambiguous. Calls with 4 arguments keep working through the defaults.
-- -----------------------------------------------------------------------------
drop function if exists public.request_ride(uuid, double precision, double precision, text);

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

  -- destination coordinates: all-or-nothing, never an error
  if v_dlat is null or v_dlng is null or v_dlat not between -90 and 90 or v_dlng not between -180 and 180 then
    v_dlat := null;
    v_dlng := null;
  end if;

  -- free the slot if a previous request silently timed out
  update public.rides set status = 'expired'
   where client_id = v_uid and status = 'requested' and expires_at <= now();

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

revoke all on function public.request_ride(uuid, double precision, double precision, text,
  double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.request_ride(uuid, double precision, double precision, text,
  double precision, double precision, text) to authenticated;


-- =============================================================================
-- Boda Kilgoris — "Shopping list" orders, PART 1 of 2: new ride statuses.
-- Run this file ALONE first, then 20261021000100_shopping.sql (a new enum value cannot be used in
-- the same transaction that adds it, and the SQL editor runs one script per transaction).
-- Idempotent.
-- =============================================================================
alter type public.ride_status add value if not exists 'shopping';
alter type public.ride_status add value if not exists 'purchased';
alter type public.ride_status add value if not exists 'delivering';
