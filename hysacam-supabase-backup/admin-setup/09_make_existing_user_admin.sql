-- HYSACAM Kumba: promote an EXISTING, verified Supabase Auth user to admin.
-- Run this in Supabase SQL Editor as the project owner.
-- Replace the email below with the exact email of the account you control.
-- This does NOT create an account or set/reset a password.
-- Never put a Supabase service_role key in this file or in frontend code.

DO $$
DECLARE
  target_email text := lower(trim('REPLACE_WITH_YOUR_VERIFIED_ACCOUNT_EMAIL'));
  target_user_id uuid;
BEGIN
  IF target_email = '' OR target_email = 'replace_with_your_verified_account_email' THEN
    RAISE EXCEPTION 'Edit target_email in this script before running it.';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = target_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user exists for %. Register and verify this account first.', target_email;
  END IF;

  UPDATE public.profiles
  SET role = 'admin', approval_status = 'approved', email = target_email,
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user exists, but no public.profiles row exists. Check the on_auth_user_created trigger before proceeding.';
  END IF;

  RAISE NOTICE 'Administrator role granted to %. Keep this account secure.', target_email;
END $$;

-- Verify the result (should show role=admin and approval_status=approved).
SELECT p.id, p.email, p.role, p.approval_status
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id
WHERE lower(u.email) = lower(trim('REPLACE_WITH_YOUR_VERIFIED_ACCOUNT_EMAIL'));
