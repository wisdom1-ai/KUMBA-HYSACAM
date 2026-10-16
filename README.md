# HYSACAM Kumba Community Tracker — New Build

A fresh responsive front-end prototype for exploring illustrative waste-bin locations, submitting local reports, viewing report history, and editing a local profile

## Run it
1 Extract the ZIP file
2 Open `index.html` in a modern browser, or use VS Code with the Live Server extension
3 Internet access is required for Leaflet and OpenStreetMap tiles

## Included features
- Responsive desktop sidebar and fixed five-item mobile bottom navigation
- Overview dashboard and sample stats
- Interactive Leaflet maps with sample location markers and status filters
- Searchable dustbin directory
- Report submission form with browser-local persistence
- My Reports list and CSV export
- Editable local profile and clear-local-data control
- Help and support page

## Important limitations
This is a standalone prototype Sample locations and status values are illustrative, not verified official HYSACAM data Reports and profile settings are stored in the current browser's `localStorage` only No shared database, user authentication, live HYSACAM feed, GPS tracking, or official report delivery is connected

To make this production-ready for multiple users, connect a backend/database (for example Supabase) with appropriate authentication, access policies, and an official reporting workflow Keep database keys and privileged credentials out of browser JavaScript
