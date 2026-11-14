-- OPTIONAL: clear the password-reset rate-limit entry for your own test account.
-- Replace YOUR_EMAIL with the account email you are testing, then run once in Supabase SQL Editor.
-- Keep rate limiting enabled; this only clears the selected email's counter.
delete from public.hysacam_auth_rate_limits
where key_hash = encode(
  digest('password-reset:' || lower(trim('YOUR_EMAIL')), 'sha256'),
  'hex'
);
