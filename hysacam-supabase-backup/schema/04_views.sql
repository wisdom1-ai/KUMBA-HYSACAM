CREATE OR REPLACE VIEW public."Dustbins" AS
  SELECT id, name, latitude AS latitute, longitude, location_description, created_at
  FROM public.dustbins;

CREATE OR REPLACE VIEW public.valid_cleanings AS
  SELECT id, dustbin_id, dustbin_name, dustbin_area, worker_id, task_id, cleaned_at,
         recorded_status, notes, valid_until, idempotency_key, created_at
  FROM public.cleaning_history
  WHERE valid_until > now();
