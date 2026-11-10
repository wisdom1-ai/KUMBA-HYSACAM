-- Read-only checks. Replace the email with the account you are testing.
SELECT
  u.id AS auth_user_id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_is_verified,
  p.role,
  p.approval_status,
  (p.role = 'admin' AND p.approval_status = 'approved') AS profile_is_admin
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower(trim('REPLACE_WITH_YOUR_ACCOUNT_EMAIL'));
