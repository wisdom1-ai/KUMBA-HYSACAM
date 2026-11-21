# HYSACAM Kumba Tracker — Dashboard redesign

## What changed
- Rebuilt the resident homepage as a responsive, mobile-first dashboard with Home, Map, Reports, Settings and Profile tabs.
- Reused the existing HYSACAM recycling-symbol SVG as the only brand mark.
- Updated Leaflet dustbin pins to use the recycling symbol (selected pins use blue to distinguish the selected location).
- Kept the existing Supabase-backed dustbin directory and verified cleaning-record loader.
- Kept the existing report API integration and added a recent-report activity area and notification panel based on the signed-in resident's actual reports.
- Added account display, sign-out, privacy/password-reset navigation, notification preferences and a device-local dark appearance preference.
- Preserved the existing sign-in, sign-up, email verification and password recovery pages.
- Removed the confirmed-unreferenced legacy `js/app.js`, `js/script.js`, and duplicate `images/hysacam-symbol.png` asset. The active `js/platform.js`, `js/map.js`, `js/reports.js`, authentication scripts, server routes and SQL setup files remain.

## Important backend notes
- Dustbin markers and directory rows come from the existing Supabase `bins` table. Only records with valid latitude and longitude can appear as map markers.
- Cleaning history comes from verified rows in `cleaning_records`.
- Resident reports and report notifications use the existing `/api/reports` endpoint and authenticated server session. The hosting environment must deploy the existing `api/` and `server/` functions for this to work.
- Email notification delivery is not fabricated by the frontend. It depends on the configured authentication/email provider and backend setup.
- Dark appearance and notification display preferences are saved locally in the browser on the current device.

## Deploy
Upload the contents of the `CCAS` folder to the same hosting project used by the previous version. Keep the existing environment variables and Supabase project configuration. Do not publish server secrets or SMTP credentials in frontend files.
