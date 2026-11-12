-- HYSACAM Kumba Tracker: dustbin directory, map and cleaning records
-- Run this in Supabase SQL Editor for the project's database.
-- This creates the tables expected by the current website/admin code.
-- It does NOT insert demo dustbins or invented coordinates.

create table if not exists public.bins (
  id text primary key,
  name text not null,
  area text not null,
  latitude double precision,
  longitude double precision,
  status text not null default 'Available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bins_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint bins_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint bins_coordinate_pair check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
);

-- Add any newer fields if a bins table already existed.
alter table public.bins add column if not exists name text;
alter table public.bins add column if not exists area text;
alter table public.bins add column if not exists latitude double precision;
alter table public.bins add column if not exists longitude double precision;
alter table public.bins add column if not exists status text default 'Available';
alter table public.bins add column if not exists created_at timestamptz default now();
alter table public.bins add column if not exists updated_at timestamptz default now();

create table if not exists public.cleaning_records (
  id uuid primary key default gen_random_uuid(),
  bin_id text not null references public.bins(id) on update cascade on delete restrict,
  area text not null,
  cleaned_at timestamptz not null default now(),
  activity text not null default 'Routine cleaning',
  status text not null default 'Cleaned',
  notes text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add fields used by the public tracker and admin portal if the table existed.
alter table public.cleaning_records add column if not exists bin_id text;
alter table public.cleaning_records add column if not exists area text;
alter table public.cleaning_records add column if not exists cleaned_at timestamptz default now();
alter table public.cleaning_records add column if not exists activity text default 'Routine cleaning';
alter table public.cleaning_records add column if not exists status text default 'Cleaned';
alter table public.cleaning_records add column if not exists notes text;
alter table public.cleaning_records add column if not exists verified boolean not null default false;
alter table public.cleaning_records add column if not exists created_at timestamptz default now();

create index if not exists bins_area_idx on public.bins (area);
create index if not exists bins_status_idx on public.bins (status);
create index if not exists cleaning_records_bin_id_idx on public.cleaning_records (bin_id);
create index if not exists cleaning_records_cleaned_at_idx on public.cleaning_records (cleaned_at desc);
create index if not exists cleaning_records_verified_idx on public.cleaning_records (verified, cleaned_at desc);

alter table public.bins enable row level security;
alter table public.cleaning_records enable row level security;

-- Public visitors can view registered dustbins. Only server-side admin APIs
-- using the Supabase service-role key can create, edit or delete them.
drop policy if exists "Public can read dustbins" on public.bins;
create policy "Public can read dustbins"
  on public.bins for select to anon, authenticated using (true);

-- Public visitors can view only verified cleaning records. Admin APIs use the
-- service role and can read/manage all records after checking admin sessions.
drop policy if exists "Public can read verified cleaning records" on public.cleaning_records;
create policy "Public can read verified cleaning records"
  on public.cleaning_records for select to anon, authenticated using (verified = true);

grant select on public.bins to anon, authenticated;
grant select on public.cleaning_records to anon, authenticated;

-- No public INSERT/UPDATE/DELETE policies are created intentionally.
-- Keep SUPABASE_SERVICE_ROLE_KEY only in Vercel server environment variables.
