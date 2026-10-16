-- OPTIONAL. Run once in the Supabase SQL editor.
--
-- The apps already call sweep_rides() every 30 s while somebody has the app open, which is
-- enough for phase 1. With pg_cron the housekeeping also runs when NOBODY has the app open:
--   * unanswered requests are marked `expired` after 2 min
--   * completed rides are auto-confirmed (flag `auto_confirmed`) after 30 min
--   * Bodas who closed the app are switched to unavailable
-- so the admin counters are always exact, even at 3 am.
--
-- Enable the extension first: Dashboard > Database > Extensions > pg_cron.
create extension if not exists pg_cron;

-- run_sweep() is the same housekeeping the apps trigger through sweep_rides().
select cron.schedule('boda-sweep', '* * * * *', 'select public.run_sweep()');
-- To stop it: select cron.unschedule('boda-sweep');
