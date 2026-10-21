-- OPTIONAL. Run once in the Supabase SQL editor (pg_cron must be enabled: Database > Extensions).
--
-- The alerts retention (delete old handled / ignored alerts, wipe the text of old open ones) already runs
-- by itself, at most once every 20 h, whenever somebody's app calls sweep_rides(). With pg_cron it also runs
-- when nobody has the app open. The function is idempotent, so running both is harmless.
create extension if not exists pg_cron;
select cron.schedule('boda-alerts-retention', '17 1 * * *', 'select private.alerts_retention(true)');
-- To stop it: select cron.unschedule('boda-alerts-retention');
