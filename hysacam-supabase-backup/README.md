# Hysacam Kumba Tracking - Supabase backup
Project ref: wlkchflkgvhripfmeyzm | Region: eu-west-1 | Postgres 17
Exported: 2026-11-10

Run the files in this order in the Supabase SQL Editor of a NEW project:
1. schema/01_enums.sql
2. schema/02_tables.sql
3. schema/03_indexes.sql
4. schema/04_views.sql
5. functions/05_functions.sql
6. functions/06_triggers.sql
7. security/07_rls_policies.sql
8. security/08_realtime.sql

Notes:
- All tables currently have 0 rows, so there is no data to export.
- No Edge Functions exist in this project.
- Checked on 2026-11-10: 0 rows in every table, 0 auth users, no storage buckets or files. Nothing else to export.
- Realtime is enabled on dustbins, collection_tasks, cleaning_history, community_reports (file 08).
- Applied migrations (names only): stage2_profiles_and_roles, stage3a_rename_dustbins_with_compat_view,
  stage3b_dustbins_columns_rls_realtime, stage4_tasks_history_reports_tables, stage5_functions_rls_realtime
- The view public."Dustbins" is a compatibility view over public.dustbins (column latitute is a typo kept on purpose).

Admin setup add-on:
- See README-ADMIN-SETUP.txt for safe instructions for an existing project.
- admin-setup/09_make_existing_user_admin.sql promotes one existing verified account; it does not create users or passwords.
- admin-setup/10_admin_account_diagnostics.sql checks the account role and verification state.
- Do not expose or embed a Supabase service_role key.
