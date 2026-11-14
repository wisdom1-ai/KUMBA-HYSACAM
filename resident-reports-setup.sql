-- HYSACAM Kumba Tracker: resident profiles and report records
-- Run this in the SQL Editor of the Supabase project used by the live website.

create table if not exists public.resident_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  area text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resident_reports (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  resident_id uuid not null references auth.users(id) on delete restrict,
  reporter_name text not null,
  reporter_email text not null,
  reporter_phone text,
  issue_type text not null,
  location_description text not null,
  area text not null,
  description text not null,
  latitude double precision,
  longitude double precision,
  photo_path text,
  status text not null default 'submitted' check (status in ('submitted','under_review','assigned','in_progress','resolved','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resident_reports_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint resident_reports_longitude_range check (longitude is null or longitude between -180 and 180)
);

create index if not exists resident_reports_resident_created_idx on public.resident_reports(resident_id, created_at desc);
create index if not exists resident_reports_status_created_idx on public.resident_reports(status, created_at desc);

alter table public.resident_profiles enable row level security;
alter table public.resident_reports enable row level security;

drop policy if exists "Residents read own profile" on public.resident_profiles;
create policy "Residents read own profile" on public.resident_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Residents insert own profile" on public.resident_profiles;
create policy "Residents insert own profile" on public.resident_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Residents update own profile" on public.resident_profiles;
create policy "Residents update own profile" on public.resident_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Residents read own reports" on public.resident_reports;
create policy "Residents read own reports" on public.resident_reports for select to authenticated using (auth.uid() = resident_id);
drop policy if exists "Residents submit own reports" on public.resident_reports;
create policy "Residents submit own reports" on public.resident_reports for insert to authenticated with check (auth.uid() = resident_id);

-- The Vercel API uses the service-role key only on the server and verifies the
-- HttpOnly resident session before every read/write. Never expose that key in HTML.
