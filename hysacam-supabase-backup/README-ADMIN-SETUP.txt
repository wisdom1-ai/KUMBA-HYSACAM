HYSACAM KUMBA - ADMIN SETUP ADD-ON

This package is your friend's database backend export plus two safe admin setup scripts.
It does not contain user accounts, passwords, storage files, or secret API keys.

IMPORTANT
- The export README says it contained zero Auth users and zero table rows at export time.
- Do NOT restore the full schema over an already-running production database. It is a schema export intended for a NEW Supabase project.
- If you already ran the schema and security scripts in your current project, do not run them again just to enable admin.
- Never paste a Supabase service_role/secret key into SQL files, GitHub, browser JavaScript, or this ZIP.

TO ENABLE AN ADMIN ACCOUNT IN AN EXISTING PROJECT
1. First create a normal account on the HYSACAM website using an email you control.
2. Verify that email and make sure you can sign in normally.
3. Open Supabase Dashboard > SQL Editor.
4. Open admin-setup/09_make_existing_user_admin.sql.
5. Replace BOTH occurrences of REPLACE_WITH_YOUR_VERIFIED_ACCOUNT_EMAIL with your exact verified account email.
6. Run the script. It only promotes that existing account in public.profiles; it does not create/change its password.
7. Run admin-setup/10_admin_account_diagnostics.sql after replacing its email, to confirm role=admin and approval_status=approved.
8. In Vercel, ensure ADMIN_EMAILS contains the same email and applies to Production. Redeploy after changing environment variables.
9. Try the admin login using the same email and password that already work on normal HYSACAM sign-in.

If step 6 reports no Auth user, register/verify the account first. If it reports no profile row, stop and inspect the profile-creation trigger; do not manually insert a guessed user ID.
