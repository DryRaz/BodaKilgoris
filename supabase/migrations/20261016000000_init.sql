-- =============================================================================
-- Boda Kilgoris — Phase 1 schema
-- Tables, state machine, RLS, RPC functions, realtime, storage bucket.
--
-- Design rules
--   * Every table has RLS enabled. The `authenticated` role can only SELECT
--     (and only what its policies allow). ALL writes go through the
--     SECURITY DEFINER functions below, or through the server (service role).
--   * A ride is only COUNTED when both the Boda and the client confirmed.
--   * All "day" boundaries use the Africa/Nairobi time zone.
--   * Tunable thresholds live in `app_settings` (no redeploy needed).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
create table public.supported_languages (
  code    text primary key,
  label   text    not null,
  enabled boolean not null default true
);
-- Adding a language later = one INSERT here + one messages/<code>.json file.
insert into public.supported_languages (code, label) values
  ('en', 'English'),
  ('sw', 'Kiswahili');

create table public.app_settings (
  key         text primary key,
  value       numeric not null,
  description text
);
insert into public.app_settings (key, value, description) values
  ('request_timeout_seconds',  120, 'A ride request expires if the Boda does not answer in this time'),
  ('auto_confirm_minutes',      30, 'Client confirmation is automatic after this many minutes (auto_confirmed flag)'),
  ('suspect_min_seconds',      120, 'accepted_at -> completed_at shorter than this = suspect'),
  ('suspect_pair_per_day',      10, 'More than this many rides per day for the same client/Boda pair = suspect'),
  ('location_fresh_seconds',   180, 'A Boda location older than this is hidden from clients'),
  ('stale_available_minutes',   15, 'A Boda silent for this long is switched to unavailable'),
  ('max_active_ride_hours',      6, 'An accepted/arrived ride older than this is cancelled by the system');

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default)
$$;

create or replace function public.nairobi_day(p_ts timestamptz)
returns date language sql stable as $$
  select (p_ts at time zone 'Africa/Nairobi')::date
$$;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.user_role   as enum ('boda', 'client', 'admin');
create type public.boda_status as enum ('pending', 'approved', 'suspended');
create type public.ride_status as enum
  ('requested', 'accepted', 'arrived', 'completed', 'declined', 'expired', 'cancelled');

-- -----------------------------------------------------------------------------
-- Profiles (one row per auth.users row; created by the server on sign-up)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  role                public.user_role not null,
  name                text not null check (char_length(name) between 2 and 60),
  phone               text unique check (phone is null or phone ~ '^\+254[17][0-9]{8}$'),
  language            text not null default 'en' references public.supported_languages (code),
  geo_consent_at      timestamptz,
  pin_failed_attempts int not null default 0,        -- Boda PIN brute-force protection
  pin_locked_until    timestamptz,
  created_at          timestamptz not null default now()
);

create table public.boda_profiles (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  plate           text not null check (char_length(plate) between 3 and 15),
  photo_url       text,
  status          public.boda_status not null default 'pending',
  is_available    boolean not null default false,
  available_since timestamptz,
  rating_avg      numeric(3, 2) not null default 0,
  rating_count    int not null default 0,
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create unique index boda_profiles_plate_uq
  on public.boda_profiles (upper(regexp_replace(plate, '\s', '', 'g')));

-- Live position. Separate table so RLS can hide it unless the Boda is available.
create table public.boda_locations (
  boda_id    uuid primary key references public.boda_profiles (user_id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  accuracy_m real,
  updated_at timestamptz not null default now()
);

-- One row per Boda per day they were online: feeds "active Bodas per day".
create table public.boda_daily_activity (
  boda_id         uuid not null references public.boda_profiles (user_id) on delete cascade,
  day             date not null,
  first_online_at timestamptz not null default now(),
  last_online_at  timestamptz not null default now(),
  pings           int not null default 1,
  primary key (boda_id, day)
);

-- -----------------------------------------------------------------------------
-- Rides
-- -----------------------------------------------------------------------------
create table public.rides (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.profiles (id),
  boda_id           uuid not null references public.boda_profiles (user_id),
  status            public.ride_status not null default 'requested',

  pickup_lat        double precision not null check (pickup_lat between -90 and 90),
  pickup_lng        double precision not null check (pickup_lng between -180 and 180),
  destination_text  text check (destination_text is null or char_length(destination_text) <= 200),

  requested_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  accepted_at       timestamptz,
  arrived_at        timestamptz,
  completed_at      timestamptz,
  declined_at       timestamptz,
  expired_at        timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      text check (cancelled_by in ('client', 'boda', 'system')),

  boda_confirmed    boolean not null default false,
  client_confirmed  boolean not null default false,
  auto_confirmed    boolean not null default false,
  counted           boolean not null default false,   -- derived by trigger
  counted_at        timestamptz,
  suspect           boolean not null default false,   -- derived by trigger
  suspect_reason    text[]  not null default '{}',

  rating            smallint check (rating between 1 and 5),
  agreed_price_kes  integer  check (agreed_price_kes between 0 and 100000),

  -- Snapshots: keep the rows self-contained (history, CSV) and mean neither
  -- side ever needs to read the other's profile. Phones are copied at accept time.
  client_name       text not null,
  boda_name         text not null,
  boda_plate        text not null,
  boda_photo_url    text,
  client_phone      text,
  boda_phone        text,

  created_at        timestamptz not null default now()
);
create index rides_client_idx    on public.rides (client_id, status);
create index rides_boda_idx      on public.rides (boda_id, status);
create index rides_completed_idx on public.rides (completed_at);
create index rides_requested_idx on public.rides (requested_at);
-- one live ride per client, one running ride per Boda
create unique index rides_one_active_per_client
  on public.rides (client_id) where status in ('requested', 'accepted', 'arrived');
create unique index rides_one_running_per_boda
  on public.rides (boda_id) where status in ('accepted', 'arrived');

-- Reserved for the future daily / weekly pass. NOT used by the app in phase 1.
create type public.pass_kind as enum ('daily', 'weekly');
create table public.boda_passes (
  id             uuid primary key default gen_random_uuid(),
  boda_id        uuid not null references public.boda_profiles (user_id) on delete cascade,
  kind           public.pass_kind not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null check (ends_at > starts_at),
  amount_kes     integer not null default 0 check (amount_kes >= 0),
  payment_method text,
  payment_ref    text,
  status         text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  created_at     timestamptz not null default now()
);
create index boda_passes_boda_idx on public.boda_passes (boda_id, ends_at);

-- -----------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so RLS policies can use them safely)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- A Boda's position is visible only while the Boda is approved + available + fresh.
create or replace function public.boda_is_visible(p_boda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.boda_profiles bp
    join public.boda_locations l on l.boda_id = bp.user_id
    where bp.user_id = p_boda
      and bp.status = 'approved'
      and bp.is_available
      and l.updated_at > now() - make_interval(secs => public.setting_num('location_fresh_seconds', 180))
  )
$$;

-- A client may follow only the Boda who accepted their ride.
create or replace function public.client_follows_boda(p_boda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rides r
    where r.boda_id = p_boda and r.client_id = auth.uid()
      and r.status in ('accepted', 'arrived')
  )
$$;

-- -----------------------------------------------------------------------------
-- Ride state machine (trigger)
--   requested -> accepted -> arrived -> completed
--   requested -> declined | expired | cancelled
--   accepted / arrived -> cancelled
-- Also derives: timestamps, boda_confirmed, counted, suspect flags.
-- -----------------------------------------------------------------------------
create or replace function public.rides_guard()
returns trigger language plpgsql as $$
declare
  reasons    text[] := '{}';
  pair_count int;
begin
  if tg_op = 'INSERT' then
    new.counted := false;
    new.counted_at := null;
    return new;
  end if;

  if new.client_id <> old.client_id or new.boda_id <> old.boda_id
     or new.pickup_lat <> old.pickup_lat or new.pickup_lng <> old.pickup_lng
     or new.requested_at <> old.requested_at then
    raise exception 'immutable_field';
  end if;

  if new.status <> old.status then
    if not (
         (old.status = 'requested' and new.status in ('accepted', 'declined', 'expired', 'cancelled'))
      or (old.status = 'accepted'  and new.status in ('arrived', 'cancelled'))
      or (old.status = 'arrived'   and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'invalid_transition';
    end if;

    if new.status = 'accepted'  then new.accepted_at  := coalesce(new.accepted_at, now()); end if;
    if new.status = 'arrived'   then new.arrived_at   := coalesce(new.arrived_at, now()); end if;
    if new.status = 'declined'  then new.declined_at  := coalesce(new.declined_at, now()); end if;
    if new.status = 'expired'   then new.expired_at   := coalesce(new.expired_at, now()); end if;
    if new.status = 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now()); end if;

    if new.status = 'completed' then
      new.completed_at   := coalesce(new.completed_at, now());
      new.boda_confirmed := true;            -- "Ride completed" = the Boda's confirmation

      if new.completed_at - new.accepted_at
           < make_interval(secs => public.setting_num('suspect_min_seconds', 120)) then
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

  new.counted := new.status = 'completed' and new.boda_confirmed and new.client_confirmed;
  if new.counted and not old.counted then
    new.counted_at := now();
  elsif not new.counted then
    new.counted_at := old.counted_at;
  end if;

  return new;
end $$;

create trigger rides_guard_trg
  before insert or update on public.rides
  for each row execute function public.rides_guard();

-- If a pair crosses the daily limit, the whole chain of that day is suspect.
create or replace function public.rides_flag_pair()
returns trigger language plpgsql as $$
begin
  update public.rides r
     set suspect = true,
         suspect_reason = array_append(r.suspect_reason, 'pair_frequency')
   where r.client_id = new.client_id and r.boda_id = new.boda_id
     and r.status = 'completed' and r.id <> new.id
     and public.nairobi_day(r.completed_at) = public.nairobi_day(new.completed_at)
     and not ('pair_frequency' = any (r.suspect_reason));
  return null;
end $$;

create trigger rides_flag_pair_trg
  after update on public.rides
  for each row
  when (new.status = 'completed' and old.status <> 'completed' and 'pair_frequency' = any (new.suspect_reason))
  execute function public.rides_flag_pair();

-- Keep the Boda's average rating up to date.
create or replace function public.rides_update_rating()
returns trigger language plpgsql as $$
begin
  update public.boda_profiles bp
     set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.rides
                                where boda_id = new.boda_id and rating is not null), 0),
         rating_count = (select count(*) from public.rides
                         where boda_id = new.boda_id and rating is not null)
   where bp.user_id = new.boda_id;
  return null;
end $$;

create trigger rides_rating_trg
  after update on public.rides
  for each row
  when (new.rating is distinct from old.rating)
  execute function public.rides_update_rating();

-- A suspended / pending Boda can never be available.
create or replace function public.boda_profiles_guard()
returns trigger language plpgsql as $$
begin
  if new.status <> 'approved' then
    new.is_available := false;
    new.available_since := null;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end $$;

create trigger boda_profiles_guard_trg
  before insert or update on public.boda_profiles
  for each row execute function public.boda_profiles_guard();

-- -----------------------------------------------------------------------------
-- RPC: profile
-- -----------------------------------------------------------------------------
create or replace function public.set_language(p_language text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.supported_languages where code = p_language and enabled) then
    raise exception 'invalid_language';
  end if;
  update public.profiles set language = p_language where id = auth.uid();
end $$;

create or replace function public.set_geo_consent(p_given boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles
     set geo_consent_at = case when p_given then now() else null end
   where id = auth.uid();
end $$;

-- -----------------------------------------------------------------------------
-- RPC: Boda availability + location
-- -----------------------------------------------------------------------------
create or replace function public.touch_boda_activity(p_boda uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.boda_daily_activity (boda_id, day)
  values (p_boda, public.nairobi_day(now()))
  on conflict (boda_id, day)
  do update set last_online_at = now(), pings = public.boda_daily_activity.pings + 1
$$;

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
    if exists (select 1 from public.rides where boda_id = v_uid and status in ('accepted', 'arrived')) then
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
    -- position is only kept while available or in a running ride
    if not exists (select 1 from public.rides where boda_id = v_uid and status in ('accepted', 'arrived')) then
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
     and not exists (select 1 from public.rides where boda_id = v_uid and status in ('accepted', 'arrived')) then
    raise exception 'not_available';
  end if;
  insert into public.boda_locations (boda_id, lat, lng, accuracy_m, updated_at)
  values (v_uid, p_lat, p_lng, p_accuracy, now())
  on conflict (boda_id) do update
    set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  perform public.touch_boda_activity(v_uid);
end $$;

-- Bodas a client may choose from (name, rating, position). Nothing else leaks.
create or replace function public.available_bodas()
returns table (
  id uuid, name text, plate text, photo_url text,
  rating_avg numeric, rating_count int,
  lat double precision, lng double precision, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select bp.user_id, p.name, bp.plate, bp.photo_url, bp.rating_avg, bp.rating_count,
         l.lat, l.lng, l.updated_at
  from public.boda_profiles bp
  join public.profiles p        on p.id = bp.user_id
  join public.boda_locations l  on l.boda_id = bp.user_id
  where auth.uid() is not null
    and bp.status = 'approved'
    and bp.is_available
    and l.updated_at > now() - make_interval(secs => public.setting_num('location_fresh_seconds', 180))
$$;

-- -----------------------------------------------------------------------------
-- RPC: ride lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.request_ride(
  p_boda_id uuid, p_lat double precision, p_lng double precision, p_destination text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_client public.profiles;
  v_boda   record;
  v_ride   public.rides;
begin
  select * into v_client from public.profiles where id = v_uid;
  if not found or v_client.role <> 'client' then raise exception 'not_a_client'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location';
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
      client_id, boda_id, pickup_lat, pickup_lng, destination_text, expires_at,
      client_name, boda_name, boda_plate, boda_photo_url)
    values (
      v_uid, p_boda_id, p_lat, p_lng, nullif(btrim(p_destination), ''),
      now() + make_interval(secs => public.setting_num('request_timeout_seconds', 120)),
      v_client.name, v_boda.name, v_boda.plate, v_boda.photo_url)
    returning * into v_ride;
  exception when unique_violation then
    raise exception 'client_has_active_ride';
  end;
  return v_ride;
end $$;

create or replace function public.accept_ride(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = v_uid for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'requested' then raise exception 'invalid_state'; end if;
  if v_ride.expires_at <= now() then raise exception 'ride_expired'; end if;
  if not exists (select 1 from public.boda_profiles where user_id = v_uid and status = 'approved') then
    raise exception 'boda_not_approved';
  end if;

  begin
    update public.rides r
       set status = 'accepted',
           client_phone = (select phone from public.profiles where id = r.client_id),
           boda_phone   = (select phone from public.profiles where id = r.boda_id)
     where r.id = p_ride_id
     returning * into v_ride;
  exception when unique_violation then
    raise exception 'boda_busy';
  end;

  -- automatically unavailable during a ride
  update public.boda_profiles set is_available = false, available_since = null where user_id = v_uid;
  -- other pending requests to this Boda are declined
  update public.rides set status = 'declined'
   where boda_id = v_uid and status = 'requested' and id <> p_ride_id;
  return v_ride;
end $$;

create or replace function public.decline_ride(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'requested' then raise exception 'invalid_state'; end if;
  update public.rides set status = 'declined' where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

create or replace function public.arrive_ride(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'accepted' then raise exception 'invalid_state'; end if;
  update public.rides set status = 'arrived' where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

create or replace function public.complete_ride(p_ride_id uuid, p_price_kes integer default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and boda_id = auth.uid() for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'arrived' then raise exception 'invalid_state'; end if;
  if p_price_kes is not null and (p_price_kes < 0 or p_price_kes > 100000) then
    raise exception 'invalid_price';
  end if;
  update public.rides set status = 'completed', agreed_price_kes = p_price_kes
   where id = p_ride_id returning * into v_ride;
  -- the ride is over: stop exposing the Boda's position (he stays unavailable until he toggles)
  delete from public.boda_locations l
   where l.boda_id = v_ride.boda_id
     and not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available);
  return v_ride;
end $$;

create or replace function public.confirm_ride(p_ride_id uuid, p_rating smallint default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and client_id = auth.uid() for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status <> 'completed' then raise exception 'invalid_state'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  if v_ride.client_confirmed then return v_ride; end if;   -- idempotent
  update public.rides set client_confirmed = true, rating = p_rating
   where id = p_ride_id returning * into v_ride;
  return v_ride;
end $$;

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
  if v_ride.status not in ('requested', 'accepted', 'arrived') then raise exception 'invalid_state'; end if;
  v_by := case when v_ride.client_id = v_uid then 'client' else 'boda' end;
  update public.rides set status = 'cancelled', cancelled_by = v_by
   where id = p_ride_id returning * into v_ride;
  delete from public.boda_locations l
   where l.boda_id = v_ride.boda_id
     and not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available);
  return v_ride;
end $$;

-- Idempotent housekeeping. Not callable by clients: reached through sweep_rides() (apps, every
-- ~30 s) or by pg_cron (see supabase/optional_cron.sql).
create or replace function public.run_sweep()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 1. requests nobody answered
  update public.rides set status = 'expired'
   where status = 'requested' and expires_at <= now();

  -- 2. client did not confirm in time -> auto-confirm (flagged)
  update public.rides
     set client_confirmed = true, auto_confirmed = true
   where status = 'completed' and boda_confirmed and not client_confirmed
     and completed_at <= now() - make_interval(mins => public.setting_num('auto_confirm_minutes', 30)::int);

  -- 3. rides that never finished
  update public.rides set status = 'cancelled', cancelled_by = 'system'
   where status in ('accepted', 'arrived')
     and accepted_at <= now() - make_interval(hours => public.setting_num('max_active_ride_hours', 6)::int);

  -- 4. Bodas that went silent (app closed / phone off) are no longer "available"
  update public.boda_profiles bp
     set is_available = false, available_since = null
   where bp.is_available
     and coalesce((select l.updated_at from public.boda_locations l where l.boda_id = bp.user_id),
                  bp.available_since)
         < now() - make_interval(mins => public.setting_num('stale_available_minutes', 15)::int);

  -- 5. no location kept for a Boda who is neither available nor in a running ride
  delete from public.boda_locations l
   where not exists (select 1 from public.boda_profiles bp where bp.user_id = l.boda_id and bp.is_available)
     and not exists (select 1 from public.rides r where r.boda_id = l.boda_id and r.status in ('accepted', 'arrived'));
end $$;

-- What the apps call. Returns the server time so clients can correct a wrong phone clock.
create or replace function public.sweep_rides()
returns timestamptz language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.run_sweep();
  return now();
end $$;

-- -----------------------------------------------------------------------------
-- RPC: admin
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_boda_status(p_boda_id uuid, p_status public.boda_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.boda_profiles set status = p_status where user_id = p_boda_id;
  if not found then raise exception 'not_found'; end if;
  if p_status <> 'approved' then
    delete from public.boda_locations l
     where l.boda_id = p_boda_id
       and not exists (select 1 from public.rides r where r.boda_id = l.boda_id and r.status in ('accepted', 'arrived'));
  end if;
end $$;

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
  ) into v_rides from public.rides;

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

create or replace function public.admin_daily_series(p_days int default 30)
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
    from public.rides group by 1
  ),
  done as (
    select public.nairobi_day(completed_at) as day,
           count(*) as completed,
           count(*) filter (where counted) as counted,
           count(*) filter (where counted and not suspect) as counted_clean,
           count(*) filter (where suspect) as suspect
    from public.rides where completed_at is not null group by 1
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

create or replace function public.admin_boda_stats()
returns table (
  id uuid, name text, phone text, plate text, photo_url text,
  status public.boda_status, is_available boolean,
  rating_avg numeric, rating_count int, created_at timestamptz,
  requests int, responded int, accepted int, counted int, suspect int,
  avg_accept_seconds int, last_online_at timestamptz)
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
         (select max(a.last_online_at) from public.boda_daily_activity a where a.boda_id = bp.user_id)
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
    from public.rides r group by r.boda_id
  ) s on s.boda_id = bp.user_id
  order by (bp.status = 'pending') desc, p.name;
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.supported_languages  enable row level security;
alter table public.app_settings         enable row level security;
alter table public.profiles             enable row level security;
alter table public.boda_profiles        enable row level security;
alter table public.boda_locations       enable row level security;
alter table public.boda_daily_activity  enable row level security;
alter table public.rides                enable row level security;
alter table public.boda_passes          enable row level security;

-- Nobody writes directly: no INSERT/UPDATE/DELETE grants and no such policies.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.supported_languages to anon, authenticated;
grant select on public.app_settings        to authenticated;
grant select on public.profiles            to authenticated;
grant select on public.boda_profiles       to authenticated;
grant select on public.boda_locations      to authenticated;
grant select on public.boda_daily_activity to authenticated;
grant select on public.rides               to authenticated;
grant select on public.boda_passes         to authenticated;

create policy languages_read on public.supported_languages
  for select using (true);

create policy settings_admin_read on public.app_settings
  for select to authenticated using (public.is_admin());

-- A user sees only their own profile. (Names/phones of the other party of a ride
-- are snapshotted on the ride row, so no cross-profile read is needed.)
create policy profiles_read on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

create policy boda_profiles_read on public.boda_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Position visibility: own / admin / only while the Boda is available
-- / only to the client whose ride this Boda accepted.
create policy boda_locations_read on public.boda_locations
  for select to authenticated using (
    boda_id = auth.uid()
    or public.is_admin()
    or public.boda_is_visible(boda_id)
    or public.client_follows_boda(boda_id)
  );

create policy activity_admin_read on public.boda_daily_activity
  for select to authenticated using (public.is_admin());

create policy rides_read on public.rides
  for select to authenticated using (
    client_id = auth.uid() or boda_id = auth.uid() or public.is_admin()
  );

create policy passes_read on public.boda_passes
  for select to authenticated using (boda_id = auth.uid() or public.is_admin());

-- Function privileges. Supabase grants EXECUTE on new public functions to anon AND authenticated
-- by default, so revoke from both and grant back only the RPCs the apps need. (Internal helpers
-- such as run_sweep() and touch_boda_activity() stay private.)
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_admin(), public.boda_is_visible(uuid), public.client_follows_boda(uuid),
  public.setting_num(text, numeric), public.nairobi_day(timestamptz),
  public.set_language(text), public.set_geo_consent(boolean),
  public.set_availability(boolean, double precision, double precision, real),
  public.update_location(double precision, double precision, real),
  public.available_bodas(),
  public.request_ride(uuid, double precision, double precision, text),
  public.accept_ride(uuid), public.decline_ride(uuid), public.arrive_ride(uuid),
  public.complete_ride(uuid, integer), public.confirm_ride(uuid, smallint),
  public.cancel_ride(uuid), public.sweep_rides(),
  public.admin_set_boda_status(uuid, public.boda_status),
  public.admin_overview(), public.admin_daily_series(int), public.admin_boda_stats()
to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (rides + live positions + availability)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.rides;          exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.boda_locations; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.boda_profiles;   exception when duplicate_object then null; end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Storage: public bucket for Boda photos (uploaded by the server only)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('boda-photos', 'boda-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
