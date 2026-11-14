-- HYSACAM: align dustbin registration with the existing UUID-based database.
-- Safe for the current schema shown in the supplied Supabase screenshots.
-- Run once in Supabase SQL Editor before deploying the updated website.

begin;

alter table public.bins
  add column if not exists bin_code text;

-- Give existing rows stable display codes derived from their UUID.
-- Existing UUID primary keys and cleaning-record references remain unchanged.
update public.bins
set bin_code = 'BIN-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where bin_code is null or btrim(bin_code) = '';

alter table public.bins
  alter column bin_code set not null;

create unique index if not exists bins_bin_code_uidx
  on public.bins (bin_code);

-- The existing cleaning_records.bin_id is UUID and references bins.id.
-- Do not change its type or recreate the relationship.
create index if not exists cleaning_records_bin_id_idx
  on public.cleaning_records (bin_id);

commit;
