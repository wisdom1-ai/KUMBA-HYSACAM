-- HYSACAM Kumba Tracker: password reset support
-- Run this in Supabase SQL Editor if the authentication tables already exist.

create table if not exists public.hysacam_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  encrypted_refresh_token text,
  encrypted_signup_password text,
  constraint hysacam_auth_challenges_email_purpose_key unique (email, purpose)
);

alter table public.hysacam_auth_challenges
  add column if not exists encrypted_signup_password text;

alter table public.hysacam_auth_challenges
  drop constraint if exists hysacam_auth_challenges_purpose_check;

alter table public.hysacam_auth_challenges
  add constraint hysacam_auth_challenges_purpose_check
  check (purpose in ('signup', 'login', 'password_reset'));

-- Ensure the upsert key used by the API exists.
create unique index if not exists hysacam_auth_challenges_email_purpose_uidx
  on public.hysacam_auth_challenges (email, purpose);

alter table public.hysacam_auth_challenges enable row level security;
revoke all on public.hysacam_auth_challenges from anon, authenticated;
