--------------------------------------------------------------------------------
-- Up Migration
--------------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN quota_paid numeric(78,0) DEFAULT 0 NOT NULL;
ALTER TABLE public.clients ADD COLUMN quota_used numeric(78,0) DEFAULT 0 NOT NULL;

-- UPDATE 'quota_paid' for all existing clients
UPDATE public.clients AS c
SET quota_paid = r.sum
FROM (
    SELECT client_id, SUM(quota) AS sum
    FROM public.quotas
    WHERE quota > 0
    GROUP BY client_id
) AS r
WHERE c.id = r.client_id;

-- UPDATE 'quota_used' for all existing clients
-- we use '* -1' since all spending of quota are marked as negatives
UPDATE public.clients AS c
SET quota_used = (r.sum * -1)
FROM (
    SELECT client_id, SUM(quota) AS sum
    FROM public.quotas
    WHERE quota < 0
    GROUP BY client_id
) AS r
WHERE c.id = r.client_id;

--------------------------------------------------------------------------------
-- Down Migration
--------------------------------------------------------------------------------
ALTER TABLE public.clients DROP COLUMN quota_paid;
ALTER TABLE public.clients DROP COLUMN quota_used;