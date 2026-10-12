# HYSACAM Kumba Tracker

## Start
1. Extract this ZIP.
2. Double-click `START_HYSACAM_TRACKER.bat`.
3. Keep the black server window open.
4. Use `http://127.0.0.1:8000/index.html`; do not open `index.html` directly.

## Functionality and data
- The existing HTML/CSS design is retained. Existing browser storage keys are retained and are not cleared.
- Collection points remain in browser storage under `hysacam_kumba_bins`; existing saved points are preserved. New collection points require a name, area, and valid latitude/longitude.
- Fresh browsers no longer get two unverified sample collection points automatically. Add locations only after checking their coordinates in Kumba.
- Reports are saved to local browser history and posted to the Python server, which stores report metadata in `data/reports.json`. This local installation is not yet a hosted, multi-user database.
- The map requires internet access for Leaflet and OpenStreetMap tiles.

## Enable real email notifications
1. Replace `YOUR_EMAIL_HERE` in `email_config.json` with the inbox that should receive reports.
2. For Gmail, enable 2-Step Verification and create an App Password.
3. Set `smtp_user` to the sending Gmail account and `smtp_app_password` to the App Password. Do not use your normal Gmail password.
4. Save and restart the BAT file, then submit a test report and check the server window and recipient inbox.

Until SMTP is configured, the server can save reports but cannot send email. Keep `email_config.json` private and never publish it to GitHub.
