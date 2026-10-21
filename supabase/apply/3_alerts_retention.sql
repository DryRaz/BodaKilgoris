-- =============================================================================
-- Boda Kilgoris — PRODUCTION, alerts retention function (the ONLY piece of the admin-alerts migration
-- that the automated tool could not apply, because it contains DELETE statements).
-- Paste the whole file in the Supabase SQL Editor and run it. Idempotent.
-- =============================================================================
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
