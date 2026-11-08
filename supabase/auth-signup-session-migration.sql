-- HYSACAM account auto-login after successful email verification.
-- Safe to run once; it does not remove or modify existing account data.
alter table public.hysacam_auth_challenges
  add column if not exists encrypted_signup_password text;
