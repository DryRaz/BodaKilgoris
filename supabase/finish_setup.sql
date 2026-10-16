-- Boda Kilgoris: FINISH SETUP (part 2 of 2)
-- Run this ONLY on a project where the tables, triggers and the first RPC functions
-- (set_language ... arrive_ride) are already applied. Safe to re-run: every function uses
-- 'create or replace'; policies are dropped first.

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

-- drop policies first so this file can be re-run
drop policy if exists languages_read on public.supported_languages;
drop policy if exists settings_admin_read on public.app_settings;
drop policy if exists profiles_read on public.profiles;
drop policy if exists boda_profiles_read on public.boda_profiles;
drop policy if exists boda_locations_read on public.boda_locations;
drop policy if exists activity_admin_read on public.boda_daily_activity;
drop policy if exists rides_read on public.rides;
drop policy if exists passes_read on public.boda_passes;

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
