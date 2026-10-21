-- =============================================================================
-- Boda Kilgoris — PRIVATE admin alerts when an order contains a sensitive term.
-- Run AFTER 20261022000000_catalog_seed_and_public_read.sql. Idempotent.
--
-- NOTHING is ever blocked: the order is sent and handled exactly as before. A trigger records an alert
-- for the admin only. The three new tables live in a schema called "private" that the API does not
-- expose, so neither clients nor Bodas can read them, count them or even detect that they exist
-- (the API answers "table not found" / "invalid schema"), and Realtime never carries them.
-- The admin reads and manages everything through SECURITY DEFINER functions that check is_admin().
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Text normalisation shared by the alerts (and anything that must compare names the same way)
--   "M-Pesa", "m  pesa" -> "m pesa";  "Tusker!" -> "tusker"
-- -----------------------------------------------------------------------------
create or replace function public.normalize_item_name(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;
revoke all on function public.normalize_item_name(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- blocked_terms: the sensitive words, grouped by category. alert_enabled decides whether the term raises an alert.
-- -----------------------------------------------------------------------------
create table if not exists private.blocked_terms (
  id            uuid primary key default gen_random_uuid(),
  term          text not null,
  category      text not null,
  alert_enabled boolean not null default true,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
-- adapt to a blocked_terms table that already exists
alter table private.blocked_terms add column if not exists category      text;
alter table private.blocked_terms add column if not exists alert_enabled boolean not null default true;
alter table private.blocked_terms add column if not exists active        boolean not null default true;
alter table private.blocked_terms add column if not exists created_at    timestamptz not null default now();
alter table private.blocked_terms enable row level security;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blocked_terms_category_chk') then
    alter table private.blocked_terms add constraint blocked_terms_category_chk
      check (category in ('alcohol', 'tobacco_drugs', 'health', 'money', 'danger', 'insult'));
  end if;
end $$;
create unique index if not exists blocked_terms_norm_uq on private.blocked_terms (public.normalize_item_name(term));

-- starting list (an existing term is never duplicated nor changed)
insert into private.blocked_terms (term, category, alert_enabled)
select v.term, v.category, v.alert_enabled
from (values
  ('beer','alcohol',true),('bia','alcohol',true),('pombe','alcohol',true),('tusker','alcohol',true),('guinness','alcohol',true),
  ('pilsner','alcohol',true),('lager','alcohol',true),('whisky','alcohol',true),('whiskey','alcohol',true),('vodka','alcohol',true),
  ('gin','alcohol',true),('rum','alcohol',true),('brandy','alcohol',true),('wine','alcohol',true),('divai','alcohol',true),
  ('mvinyo','alcohol',true),('cider','alcohol',true),('konyagi','alcohol',true),('smirnoff','alcohol',true),('gilbeys','alcohol',true),
  ('johnnie walker','alcohol',true),('captain morgan','alcohol',true),('kenya cane','alcohol',true),('savanna','alcohol',true),
  ('alcohol','alcohol',true),('liquor','alcohol',true),('changaa','alcohol',true),('chang aa','alcohol',true),('busaa','alcohol',true),
  ('muratina','alcohol',true),('kumi kumi','alcohol',true),
  ('cigarette','tobacco_drugs',true),('sigara','tobacco_drugs',true),('sigareti','tobacco_drugs',true),('tobacco','tobacco_drugs',true),
  ('tumbaku','tobacco_drugs',true),('snuff','tobacco_drugs',true),('ugoro','tobacco_drugs',true),('kuber','tobacco_drugs',true),
  ('shisha','tobacco_drugs',true),('vape','tobacco_drugs',true),('vaping','tobacco_drugs',true),('bangi','tobacco_drugs',true),
  ('bhang','tobacco_drugs',true),('marijuana','tobacco_drugs',true),('weed','tobacco_drugs',true),('cannabis','tobacco_drugs',true),
  ('cocaine','tobacco_drugs',true),('heroin','tobacco_drugs',true),
  ('antibiotic','health',false),('amoxicillin','health',false),('tramadol','health',false),('diazepam','health',false),('valium','health',false),
  ('morphine','health',false),('codeine','health',false),('ketamine','health',false),('rohypnol','health',false),('mifepristone','health',false),
  ('misoprostol','health',false),('cytotec','health',false),('viagra','health',false),('sildenafil','health',false),('steroid','health',false),
  ('abortion','health',false),
  ('cash','money',true),('pesa','money',true),('mpesa','money',true),('m pesa','money',true),('withdraw','money',true),('loan','money',true),
  ('send money','money',true),('otp','money',true),
  ('gun','danger',true),('bullet','danger',true),('ammunition','danger',true),('pistol','danger',true),('gunpowder','danger',true),('poison','danger',true),
  ('fuck','insult',false),('shit','insult',false),('bitch','insult',false),('malaya','insult',false),('mpumbavu','insult',false),('kuma','insult',false)
) as v(term, category, alert_enabled)
on conflict ((public.normalize_item_name(term))) do nothing;

-- terms that existed before this migration (hand-made table) without a category stay inert until the admin classifies them
update private.blocked_terms set category = 'insult', alert_enabled = false where category is null;
alter table private.blocked_terms alter column category set not null;

-- -----------------------------------------------------------------------------
-- settings: master switch, retention, one switch per category (app_settings is admin-read-only)
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('alerts_enabled',          1,  'Master switch for admin alerts on sensitive terms (1 = on, 0 = off)'),
  ('alerts_retention_days',   90, 'Handled / dismissed alerts are deleted after this many days; older open alerts lose their text'),
  ('alerts_category_alcohol',       1, 'Alerts for the alcohol category (1 = on)'),
  ('alerts_category_tobacco_drugs', 1, 'Alerts for the tobacco_drugs category (1 = on)'),
  ('alerts_category_health',        1, 'Alerts for the health category (1 = on); each term has its own switch too'),
  ('alerts_category_money',         1, 'Alerts for the money category (1 = on)'),
  ('alerts_category_danger',        1, 'Alerts for the danger category (1 = on)'),
  ('alerts_category_insult',        1, 'Alerts for the insult category (1 = on); each term has its own switch too')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- error_log: what the detection could not do (never shown to clients or Bodas)
-- -----------------------------------------------------------------------------
create table if not exists private.error_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  source  text not null,
  message text,
  detail  text
);
alter table private.error_log enable row level security;

-- -----------------------------------------------------------------------------
-- admin_alerts
-- -----------------------------------------------------------------------------
create table if not exists private.admin_alerts (
  id           uuid primary key default gen_random_uuid(),
  ride_id      uuid not null references public.rides (id) on delete cascade,
  ride_item_id uuid references public.ride_items (id) on delete cascade,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  term_id      uuid references private.blocked_terms (id) on delete set null,
  category     text not null,
  source       text not null check (source in ('item', 'client_note')),
  matched_text text,
  created_at   timestamptz not null default now(),
  status       text not null default 'new' check (status in ('new', 'seen', 'handled', 'dismissed')),
  admin_note   text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_at   timestamptz
);
-- one event = one alert: the same line / the same note never alerts twice for the same term,
-- and typing the same article twice in one order does not alert twice either
create unique index if not exists admin_alerts_item_term_uq on private.admin_alerts (ride_item_id, term_id) where ride_item_id is not null;
create unique index if not exists admin_alerts_ride_term_source_uq on private.admin_alerts (ride_id, term_id, source) where term_id is not null;
create index if not exists admin_alerts_status_idx on private.admin_alerts (status, created_at desc);
create index if not exists admin_alerts_client_idx on private.admin_alerts (client_id, category, created_at desc);
alter table private.admin_alerts enable row level security;

-- aggregate counters survive the deletion of old alerts
create table if not exists private.alert_daily_counts (
  day      date not null,
  category text not null,
  n        integer not null default 0,
  primary key (day, category)
);
alter table private.alert_daily_counts enable row level security;
create table if not exists private.job_state (key text primary key, last_run timestamptz);
alter table private.job_state enable row level security;

-- Defence in depth: even if the schema were ever exposed, only the admin could read (no policy for anyone else).
revoke all on all tables in schema private from public, anon, authenticated;
drop policy if exists admin_alerts_admin on private.admin_alerts;
create policy admin_alerts_admin on private.admin_alerts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists blocked_terms_admin on private.blocked_terms;
create policy blocked_terms_admin on private.blocked_terms for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists error_log_admin on private.error_log;
create policy error_log_admin on private.error_log for select to authenticated using (public.is_admin());

-- the notice shown to a client the first time they send an order
alter table public.profiles add column if not exists notice_shown_at    timestamptz;
alter table public.profiles add column if not exists notice_accepted_at timestamptz;

-- -----------------------------------------------------------------------------
-- Detection. A failure here must NEVER fail or slow the order: every call is wrapped, errors go to error_log.
-- Whole words only ("gin" matches, "ginger" does not): both sides go through normalize_item_name().
-- -----------------------------------------------------------------------------
create or replace function private.alert_scan(
  p_ride uuid, p_item uuid, p_client uuid, p_text text, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_norm text;
begin
  if coalesce((select s.value from public.app_settings s where s.key = 'alerts_enabled'), 1) = 0 then return; end if;
  v_norm := public.normalize_item_name(p_text);
  if v_norm = '' then return; end if;

  with hits as (
    select t.id, t.category
      from private.blocked_terms t
     where t.active and t.alert_enabled
       and public.normalize_item_name(t.term) <> ''
       and coalesce((select s.value from public.app_settings s where s.key = 'alerts_category_' || t.category), 1) <> 0
       and (' ' || v_norm || ' ') like ('% ' || public.normalize_item_name(t.term) || ' %')
  ), ins as (
    insert into private.admin_alerts (ride_id, ride_item_id, client_id, term_id, category, source, matched_text)
    select p_ride, p_item, p_client, h.id, h.category, p_source, p_text from hits h
    on conflict do nothing
    returning category
  )
  insert into private.alert_daily_counts (day, category, n)
  select (now() at time zone 'Africa/Nairobi')::date, i.category, count(*) from ins i group by i.category
  on conflict (day, category) do update set n = private.alert_daily_counts.n + excluded.n;
end $$;
revoke all on function private.alert_scan(uuid, uuid, uuid, text, text) from public, anon, authenticated;

create or replace function private.ride_items_alert_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform private.alert_scan(new.ride_id, new.id, (select r.client_id from public.rides r where r.id = new.ride_id), new.custom_name, 'item');
  exception when others then
    begin
      raise warning 'alert detection failed (item %): % [%]', new.id, sqlerrm, sqlstate;
      insert into private.error_log (source, message, detail) values ('alert_scan_item', sqlerrm, sqlstate || ' ride_item ' || new.id);
    exception when others then null;
    end;
  end;
  return null;
end $$;

create or replace function private.rides_note_alert_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform private.alert_scan(new.id, null, new.client_id, new.client_note, 'client_note');
  exception when others then
    begin
      raise warning 'alert detection failed (note, ride %): % [%]', new.id, sqlerrm, sqlstate;
      insert into private.error_log (source, message, detail) values ('alert_scan_note', sqlerrm, sqlstate || ' ride ' || new.id);
    exception when others then null;
    end;
  end;
  return null;
end $$;
revoke all on function private.ride_items_alert_trg(), private.rides_note_alert_trg() from public, anon, authenticated;

drop trigger if exists ride_items_alert_trg on public.ride_items;
create trigger ride_items_alert_trg
  after insert on public.ride_items
  for each row when (new.is_custom and new.custom_name is not null)
  execute function private.ride_items_alert_trg();

drop trigger if exists rides_note_alert_trg on public.rides;
create trigger rides_note_alert_trg
  after insert on public.rides
  for each row when (new.type = 'shopping' and new.client_note is not null)
  execute function private.rides_note_alert_trg();

-- -----------------------------------------------------------------------------
-- Retention (daily): handled / dismissed alerts older than alerts_retention_days are deleted; older OPEN alerts keep
-- their place in the counters but lose the typed text and the private note. Called by pg_cron when it exists
-- (see supabase/optional_alerts_cron.sql) and by sweep_rides() at most once every 20 hours.
-- -----------------------------------------------------------------------------
create or replace function private.alerts_retention(p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_days  integer := greatest(1, coalesce((select s.value from public.app_settings s where s.key = 'alerts_retention_days'), 90)::integer);
  v_last  timestamptz;
  v_del   integer;
  v_wiped integer;
begin
  select last_run into v_last from private.job_state where key = 'alerts_retention';
  if not p_force and v_last is not null and v_last > now() - interval '20 hours' then
    return jsonb_build_object('skipped', true);
  end if;
  insert into private.job_state (key, last_run) values ('alerts_retention', now())
  on conflict (key) do update set last_run = excluded.last_run;

  delete from private.admin_alerts
   where status in ('handled', 'dismissed') and coalesce(handled_at, created_at) < now() - make_interval(days => v_days);
  get diagnostics v_del = row_count;

  update private.admin_alerts set matched_text = null, admin_note = null
   where status in ('new', 'seen') and created_at < now() - make_interval(days => v_days)
     and (matched_text is not null or admin_note is not null);
  get diagnostics v_wiped = row_count;

  delete from private.error_log where at < now() - interval '30 days';
  delete from private.alert_daily_counts where day < (now() at time zone 'Africa/Nairobi')::date - 800;
  return jsonb_build_object('deleted', v_del, 'wiped', v_wiped, 'days', v_days);
end $$;
revoke all on function private.alerts_retention(boolean) from public, anon, authenticated;

create or replace function public.sweep_rides()
returns timestamptz language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.run_sweep();
  begin
    perform private.alerts_retention();
  exception when others then
    raise warning 'alerts retention failed: %', sqlerrm;
  end;
  return now();
end $$;

-- -----------------------------------------------------------------------------
-- Admin API (the only way in): every function checks is_admin()
-- -----------------------------------------------------------------------------
create or replace function public.admin_alerts_count()
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select count(*)::int from private.admin_alerts where status = 'new');
end $$;

create or replace function public.admin_alerts_list(
  p_status text default null, p_category text default null, p_limit integer default 200)
returns table (
  id uuid, created_at timestamptz, category text, source text, matched_text text, status text, admin_note text,
  handled_at timestamptz, ride_id uuid, ride_type text, ride_status text, client_id uuid, client_name text,
  client_phone text, term text, recent_count integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select a.id, a.created_at, a.category, a.source, a.matched_text, a.status, a.admin_note, a.handled_at,
         a.ride_id, r.type, r.status::text, a.client_id, p.name, p.phone, t.term,
         (select count(*)::int from private.admin_alerts b
           where b.client_id = a.client_id and b.category = a.category
             and b.created_at <= a.created_at and b.created_at > a.created_at - interval '30 days')
    from private.admin_alerts a
    left join public.rides r on r.id = a.ride_id
    left join public.profiles p on p.id = a.client_id
    left join private.blocked_terms t on t.id = a.term_id
   where (p_status is null or a.status = p_status) and (p_category is null or a.category = p_category)
   order by a.created_at desc
   limit greatest(1, least(p_limit, 500));
end $$;

create or replace function public.admin_alerts_by_client(p_days integer default 90)
returns table (client_id uuid, client_name text, client_phone text, total integer, new_count integer, last_at timestamptz, by_category jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select a.client_id, p.name, p.phone, count(*)::int, (count(*) filter (where a.status = 'new'))::int, max(a.created_at),
         (select jsonb_object_agg(c.category, c.n) from (select b.category, count(*) n from private.admin_alerts b
            where b.client_id = a.client_id and b.created_at > now() - make_interval(days => greatest(p_days, 1)) group by b.category) c)
    from private.admin_alerts a
    left join public.profiles p on p.id = a.client_id
   where a.created_at > now() - make_interval(days => greatest(p_days, 1))
   group by a.client_id, p.name, p.phone
   order by max(a.created_at) desc
   limit 200;
end $$;

create or replace function public.admin_set_alert(p_id uuid, p_status text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status is not null and p_status not in ('new', 'seen', 'handled', 'dismissed') then raise exception 'invalid_alert'; end if;
  update private.admin_alerts
     set status = coalesce(p_status, status),
         handled_at = case when coalesce(p_status, status) in ('handled', 'dismissed') then coalesce(handled_at, now()) else null end,
         admin_note = case when p_note is null then admin_note else nullif(left(btrim(p_note), 1000), '') end
   where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.admin_alert_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'alerts_enabled', coalesce((select value from public.app_settings where key = 'alerts_enabled'), 1),
    'retention_days', coalesce((select value from public.app_settings where key = 'alerts_retention_days'), 90),
    'categories', (select jsonb_object_agg(c, coalesce((select value from public.app_settings where key = 'alerts_category_' || c), 1))
                     from unnest(array['alcohol', 'tobacco_drugs', 'health', 'money', 'danger', 'insult']) c),
    'terms', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'term', t.term, 'category', t.category,
                          'alert_enabled', t.alert_enabled, 'active', t.active) order by t.category, t.term)
                         from private.blocked_terms t), '[]'::jsonb),
    'daily_counts', coalesce((select jsonb_object_agg(category, n) from
                       (select category, sum(n)::int n from private.alert_daily_counts
                         where day > (now() at time zone 'Africa/Nairobi')::date - 30 group by category) d), '{}'::jsonb));
end $$;

create or replace function public.admin_set_setting(p_key text, p_value numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_key = 'alerts_retention_days' then
    if p_value is null or p_value < 1 or p_value > 3650 or p_value <> trunc(p_value) then raise exception 'invalid_setting'; end if;
  elsif p_key = 'alerts_enabled' or p_key in (select 'alerts_category_' || c from unnest(array['alcohol', 'tobacco_drugs', 'health', 'money', 'danger', 'insult']) c) then
    if p_value is null or p_value not in (0, 1) then raise exception 'invalid_setting'; end if;
  else
    raise exception 'invalid_setting';
  end if;
  insert into public.app_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

create or replace function public.admin_save_term(
  p_id uuid, p_term text, p_category text, p_alert_enabled boolean default true, p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.blocked_terms;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  p_term := lower(btrim(coalesce(p_term, '')));
  if public.normalize_item_name(p_term) = '' or char_length(p_term) > 60
     or p_category is null or p_category not in ('alcohol', 'tobacco_drugs', 'health', 'money', 'danger', 'insult') then
    raise exception 'invalid_term';
  end if;
  begin
    if p_id is null then
      insert into private.blocked_terms (term, category, alert_enabled, active)
      values (p_term, p_category, coalesce(p_alert_enabled, true), coalesce(p_active, true)) returning * into v_row;
    else
      update private.blocked_terms set term = p_term, category = p_category,
             alert_enabled = coalesce(p_alert_enabled, alert_enabled), active = coalesce(p_active, active)
       where id = p_id returning * into v_row;
      if not found then raise exception 'not_found'; end if;
    end if;
  exception when unique_violation then
    raise exception 'term_exists';
  end;
  return to_jsonb(v_row);
end $$;

-- "Test a text": which terms match, and would they raise an alert with the current switches?
create or replace function public.admin_test_text(p_text text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_norm text := public.normalize_item_name(p_text);
  v_on   boolean := coalesce((select value from public.app_settings where key = 'alerts_enabled'), 1) <> 0;
  v_out  jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'term', t.term, 'category', t.category, 'term_alert', t.alert_enabled, 'term_active', t.active,
           'category_alert', coalesce((select s.value from public.app_settings s where s.key = 'alerts_category_' || t.category), 1) <> 0,
           'would_alert', v_on and t.active and t.alert_enabled
                          and coalesce((select s.value from public.app_settings s where s.key = 'alerts_category_' || t.category), 1) <> 0)
           order by t.category, t.term), '[]'::jsonb)
    into v_out
    from private.blocked_terms t
   where v_norm <> '' and public.normalize_item_name(t.term) <> ''
     and (' ' || v_norm || ' ') like ('% ' || public.normalize_item_name(t.term) || ' %');
  return jsonb_build_object('alerts_enabled', v_on, 'matches', v_out,
    'would_alert', exists (select 1 from jsonb_array_elements(v_out) m where (m->>'would_alert')::boolean));
end $$;

-- The first-order notice (clients only): shown once; the tick box records the acceptance. Never blocks anything.
create or replace function public.record_notice(p_accepted boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles
     set notice_shown_at = coalesce(notice_shown_at, now()),
         notice_accepted_at = case when p_accepted then coalesce(notice_accepted_at, now()) else notice_accepted_at end
   where id = auth.uid();
end $$;

revoke all on function
  public.admin_alerts_count(), public.admin_alerts_list(text, text, integer), public.admin_alerts_by_client(integer),
  public.admin_set_alert(uuid, text, text), public.admin_alert_settings(), public.admin_set_setting(text, numeric),
  public.admin_save_term(uuid, text, text, boolean, boolean), public.admin_test_text(text), public.record_notice(boolean)
from public, anon, authenticated;
grant execute on function
  public.admin_alerts_count(), public.admin_alerts_list(text, text, integer), public.admin_alerts_by_client(integer),
  public.admin_set_alert(uuid, text, text), public.admin_alert_settings(), public.admin_set_setting(text, numeric),
  public.admin_save_term(uuid, text, text, boolean, boolean), public.admin_test_text(text), public.record_notice(boolean)
to authenticated;
