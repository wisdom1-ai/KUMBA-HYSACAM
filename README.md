# HYSACAM Kumba Tracker

## Run
Extract the ZIP and open `index.html` in a modern browser. The map requires an internet connection to load the Leaflet module and OpenStreetMap tiles.

## Included functionality
- Dashboard, navigation, collection map, dustbin directory, reports, report history, profile, settings, notifications, and help/support.
- Collection points are stored locally under the existing `hysacam_kumba_bins` localStorage key.
- Profile, preferences, notifications and reports use the existing HYSACAM tracker storage keys. Existing data is not automatically cleared or migrated.
- Reports are saved to this browser/device only; they are not submitted to HYSACAM without a connected backend.
- Sample collection points are not verified; confirm coordinates in the field before relying on them.

## Troubleshooting
If the map is blank, check that the device is online and that the browser allows the Leaflet CDN and OpenStreetMap tile requests. When opened as a local file, some browsers may restrict JavaScript modules; if so, serve this folder using a local static web server.


IMPORTANT — HOW TO OPEN THE WEBSITE
Do not double-click index.html. The map and directory use JavaScript ES modules, which browsers commonly block when opened directly as file://.
1. Extract the ZIP to a normal folder.
2. Double-click START_HYSACAM_TRACKER.bat.
3. Keep the black server window open while using the website.
4. The website opens at http://127.0.0.1:8000/index.html.
5. Internet access is needed for the Leaflet/OpenStreetMap map tiles and Leaflet module CDN.
If port 8000 is already in use, close the other local server or ask for help changing the port.
