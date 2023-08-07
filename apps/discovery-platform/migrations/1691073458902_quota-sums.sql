--------------------------------------------------------------------------------
-- Up Migration
--------------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN quota_paid numeric(78,0) DEFAULT 0 NOT NULL;
ALTER TABLE public.clients ADD COLUMN quota_used numeric(78,0) DEFAULT 0 NOT NULL;

--------------------------------------------------------------------------------
-- Down Migration
--------------------------------------------------------------------------------
ALTER TABLE public.clients DROP COLUMN quota_paid;
ALTER TABLE public.clients DROP COLUMN quota_used;