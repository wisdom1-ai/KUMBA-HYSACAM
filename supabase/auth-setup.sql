-- Run this SQL once in Supabase SQL Editor for HYSACAM email-code authentication.
-- These tables are server-only. Do not add public RLS policies.
create table if not exists public.hysacam_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup','login')),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  encrypted_refresh_token text,
  unique(email,purpose)
);

create table if not exists public.hysacam_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hysacam_auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);

alter table public.hysacam_auth_challenges enable row level security;
alter table public.hysacam_auth_sessions enable row level security;
alter table public.hysacam_auth_rate_limits enable row level security;

create or replace function public.hysacam_consume_rate_limit(p_key_hash text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare current_row public.hysacam_auth_rate_limits%rowtype;
begin
  insert into public.hysacam_auth_rate_limits(key_hash,window_started_at,request_count)
  values(p_key_hash,now(),1)
  on conflict(key_hash) do nothing;
  select * into current_row from public.hysacam_auth_rate_limits where key_hash=p_key_hash for update;
  if current_row.window_started_at < now() - make_interval(secs => p_window_seconds) then
    update public.hysacam_auth_rate_limits set window_started_at=now(),request_count=1 where key_hash=p_key_hash;
    return true;
  end if;
  if current_row.request_count >= p_max then return false; end if;
  update public.hysacam_auth_rate_limits set request_count=request_count+1 where key_hash=p_key_hash;
  return true;
end;
$$;

revoke all on function public.hysacam_consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.hysacam_consume_rate_limit(text,integer,integer) to service_role;
revoke all on public.hysacam_auth_challenges from anon, authenticated;
revoke all on public.hysacam_auth_sessions from anon, authenticated;
revoke all on public.hysacam_auth_rate_limits from anon, authenticated;
