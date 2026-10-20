-- =============================================================================
-- Boda Kilgoris — "Shopping list" orders, PART 1 of 2: new ride statuses.
-- Run this file ALONE first, then 20261021000100_shopping.sql (a new enum value cannot be used in
-- the same transaction that adds it, and the SQL editor runs one script per transaction).
-- Idempotent.
-- =============================================================================
alter type public.ride_status add value if not exists 'shopping';
alter type public.ride_status add value if not exists 'purchased';
alter type public.ride_status add value if not exists 'delivering';
