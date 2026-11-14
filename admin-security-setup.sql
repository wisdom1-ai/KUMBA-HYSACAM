-- HYSACAM Kumba Tracker administrator security setup.
-- Run once in Supabase SQL Editor. The service-role key is used only by server APIs.

alter table public.hysacam_auth_challenges
  drop constraint if exists hysacam_auth_challenges_purpose_check;
alter table public.hysacam_auth_challenges
  add constraint hysacam_auth_challenges_purpose_check
  check (purpose in ('signup','login','password_reset','admin_login'));

create table if not exists public.hysacam_admin_audit (
  id bigint generated always as identity primary key,
  email text not null,
  event text not null,
  outcome text not null,
  ip_address text,
  user_agent text,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.hysacam_admin_audit enable row level security;
revoke all on public.hysacam_admin_audit from anon, authenticated;
-- No client policies: only server-side service-role APIs may read/write this table.
create index if not exists hysacam_admin_audit_created_at_idx
  on public.hysacam_admin_audit (created_at desc);
create index if not exists hysacam_admin_audit_email_idx
  on public.hysacam_admin_audit (email, created_at desc);
