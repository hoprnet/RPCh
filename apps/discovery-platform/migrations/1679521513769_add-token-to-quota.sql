-- Up Migration
ALTER TABLE public.quotas
ADD COLUMN token VARCHAR(43);

CREATE INDEX quotas_token_idx ON public.quotas(token);
-- Down Migration
DROP INDEX public.quotas_token_idx;

ALTER TABLE public.quotas
DROP COLUMN token;